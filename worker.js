export default {
    async fetch(req, env) {
      const url = new URL(req.url);
      const path = url.pathname.split("/");
      const apiKey = env.FIREBASE_API_KEY;
      const projectId = env.PROJECT_ID;
  
      // ---------------- PING ----------------
      if (url.pathname === "/ping") {
        if (!apiKey || !projectId) {
          return new Response(JSON.stringify({
            status: "❌ Config manquante",
            apiKeyLoaded: !!apiKey,
            projectId: projectId || null
          }), { headers: { "Content-Type": "application/json" }, status: 500 });
        }
  
        const resCheck = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/test/config-check`
        );
        const data = await resCheck.json();
  
        if (data.error) {
          await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/test/config-check`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fields: { lastPing: { stringValue: new Date().toISOString() } }
              })
            }
          );
          return new Response(JSON.stringify({ status: "⚡ Doc créé automatiquement", projectId }), { headers: { "Content-Type": "application/json" } });
        }
  
        return new Response(JSON.stringify({ status: "✅ Config Firebase OK et Firestore accessible", projectId }), { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- WRITE ----------------
      if (path[1] === "write" && req.method === "POST") {
        const [_, __, collection, docId] = path;
        const body = await req.json();
  
        // Extraire le idToken si présent
        const idToken = body._idToken || null;
        delete body._idToken; // Retirer du body avant d'envoyer à Firestore
  
        // Si c'est un ajout de lien (mod), enrichir avec les données de GameBanana
        // MAIS ne pas enrichir si c'est une mise à jour avec un lien fightplanner: déjà généré
        const isFightPlannerLink = body.link && body.link.startsWith('fightplanner:');
        const isFileSelectionUpdate = body.needsFileSelection === 'false';
        
        console.log('[Worker] WRITE request - link:', body.link);
        console.log('[Worker] isFightPlannerLink:', isFightPlannerLink);
        console.log('[Worker] isFileSelectionUpdate:', isFileSelectionUpdate);
        
        if (collection === "links" && body.link && !isFightPlannerLink && !isFileSelectionUpdate) {
          console.log('[Worker] Enriching mod data for link:', body.link);
          try {
            // Extraire l'ID du mod depuis le lien GameBanana
            const modIdMatch = body.link.match(/gamebanana\.com\/mods\/(\d+)/);
            if (modIdMatch && modIdMatch[1]) {
              const modId = modIdMatch[1];
              console.log('[Worker] Extracted mod ID:', modId);
              
              // Faire une requête à l'API GameBanana avec _aFiles
              const gbApiUrl = `https://gamebanana.com/apiv11/Mod/${modId}?_csvProperties=_sName,_aPreviewMedia,_aSubmitter,_aModManagerIntegrations,_aFiles`;
              console.log('[Worker] Fetching from GameBanana:', gbApiUrl);
              const gbResponse = await fetch(gbApiUrl);
              
              if (gbResponse.ok) {
                const gbData = await gbResponse.json();
                console.log('[Worker] GameBanana API response received');
                
                // Store modId for later file selection
                body.modId = modId;
                
                // Extraire le nom du mod
                if (gbData._sName) {
                  body.mod_name = gbData._sName;
                  console.log('[Worker] Mod name:', body.mod_name);
                }
                
                // Extraire l'image (première image dans _aPreviewMedia._aImages)
                if (gbData._aPreviewMedia && gbData._aPreviewMedia._aImages && gbData._aPreviewMedia._aImages[0] && gbData._aPreviewMedia._aImages[0]._sFile) {
                  const imageFile = gbData._aPreviewMedia._aImages[0]._sFile;
                  body.image_url = `https://images.gamebanana.com/img/ss/mods/${imageFile}`;
                  console.log('[Worker] Image URL:', body.image_url);
                }
                
                // Extraire le créateur
                if (gbData._aSubmitter && gbData._aSubmitter._sName) {
                  body.creator = gbData._aSubmitter._sName;
                  console.log('[Worker] Creator:', body.creator);
                }
                
                // Check for multiple downloadable files FIRST
                if (gbData._aFiles && Array.isArray(gbData._aFiles) && gbData._aFiles.length > 0) {
                  console.log('[Worker] ✅ Found', gbData._aFiles.length, 'file(s)');
                  
                  // Store file information for user selection
                  const filesInfo = gbData._aFiles.map(file => ({
                    id: file._idRow,
                    name: file._sFile,
                    description: file._sDescription || '',
                    size: file._nFilesize || 0,
                    downloads: file._nDownloadCount || 0
                  }));
                  
                  body.availableFiles = JSON.stringify(filesInfo);
                  console.log('[Worker] 📋 Stored availableFiles:', filesInfo.length, 'files');
                  
                  // If multiple files, ALWAYS require file selection
                  if (gbData._aFiles.length > 1) {
                    body.needsFileSelection = 'true';
                    // Remove the link field - user must choose first
                    delete body.link;
                    console.log('[Worker] 🔔 MULTIPLE FILES - Setting needsFileSelection=true');
                    console.log('[Worker] ⚠️ DELETED link field - user must choose first');
                  }
                  
                  // If only one file, auto-select it
                  if (gbData._aFiles.length === 1) {
                    const singleFile = gbData._aFiles[0];
                    if (singleFile._sDownloadUrl) {
                      const dlIdMatch = singleFile._sDownloadUrl.match(/\/dl\/(\d+)/);
                      if (dlIdMatch) {
                        const dlId = dlIdMatch[1];
                        const fileExtension = singleFile._sFile.split('.').pop() || '7z';
                        body.link = `fightplanner:https://gamebanana.com/mmdl/${dlId},Mod,${modId},${fileExtension}`;
                        body.modInstalled = false;
                        console.log('[Worker] Auto-selected single file:', body.link);
                      }
                    }
                  }
                } else {
                  // No _aFiles, try to find FightPlanner link in integrations as fallback
                  console.log('[Worker] No _aFiles found, checking integrations...');
                  if (gbData._aModManagerIntegrations) {
                    for (const integrationKey in gbData._aModManagerIntegrations) {
                      const integrations = gbData._aModManagerIntegrations[integrationKey];
                      if (Array.isArray(integrations)) {
                        for (const integration of integrations) {
                          if (integration._sDownloadUrl && integration._sDownloadUrl.startsWith('fightplanner:')) {
                            body.link = integration._sDownloadUrl;
                            body.modInstalled = false;
                            console.log('[Worker] FightPlanner link found in integrations:', body.link);
                            break;
                          }
                        }
                      }
                    }
                  }
                }
                
                console.log('[Worker] Final enriched body:', JSON.stringify(body));
              } else {
                console.log('[Worker] GameBanana API error:', gbResponse.status);
              }
            } else {
              console.log('[Worker] No mod ID found in link');
            }
          } catch (error) {
            console.error('[Worker] Error fetching GameBanana data:', error);
          }
        } else if (isFightPlannerLink || isFileSelectionUpdate) {
          console.log('[Worker] ✅ Skipping enrichment - FightPlanner link detected or file selection completed');
          console.log('[Worker] 📝 Will save link as-is:', body.link);
          
          // Clean up file selection fields
          if (isFileSelectionUpdate) {
            console.log('[Worker] 🧹 Cleaning up file selection data');
            delete body.availableFiles;
            delete body.modId;
            delete body.needsFileSelection;
            console.log('[Worker] ✨ Cleaned body. Link is:', body.link);
          }
        }
  
        // Convertir le body en format Firestore
        const firestoreBody = {
          fields: Object.fromEntries(
            Object.entries(body).map(([k, v]) => {
              // Gérer les différents types de valeurs
              if (v === null || v === undefined) {
                return [k, { stringValue: '' }];
              }
              if (typeof v === 'boolean') {
                return [k, { booleanValue: v }];
              }
              if (typeof v === 'number') {
                return [k, { integerValue: String(v) }];
              }
              // Pour Date et autres objets, convertir en string
              return [k, { stringValue: String(v) }];
            })
          )
        };
  
        console.log('[Worker] Firestore body:', JSON.stringify(firestoreBody));
        
        // Préparer les headers avec authentification si idToken disponible
        const headers = { "Content-Type": "application/json" };
        let firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
        
        // Construire updateMask pour ne mettre à jour que les champs spécifiés (merge au lieu de replace)
        const fieldKeys = Object.keys(body);
        const updateMaskParams = fieldKeys.map(k => `updateMask.fieldPaths=${k}`).join('&');
        
        if (idToken) {
          // Utiliser le idToken pour l'authentification
          headers["Authorization"] = `Bearer ${idToken}`;
          // Ajouter updateMask pour faire un merge
          firestoreUrl += `?${updateMaskParams}`;
          console.log('[Worker] Using authenticated request with idToken and updateMask:', updateMaskParams);
        } else {
          // Fallback sur l'API key si pas de token
          firestoreUrl += `?${updateMaskParams}&key=${apiKey}`;
          console.log('[Worker] Using unauthenticated request with API key and updateMask:', updateMaskParams);
        }
  
        const res = await fetch(firestoreUrl, {
            method: "PATCH",
          headers: headers,
            body: JSON.stringify(firestoreBody)
        });
  
        const responseText = await res.text();
        console.log('[Worker] Firestore response status:', res.status);
        console.log('[Worker] Firestore response:', responseText);
  
        return new Response(responseText, { 
          status: res.status,
          headers: { "Content-Type": "application/json" } 
        });
      }
  
      // ---------------- READ ----------------
      if (path[1] === "read" && req.method === "GET") {
        const [_, __, collection, docId] = path;
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`
        );
        return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- DELETE ----------------
      if (path[1] === "delete" && req.method === "DELETE") {
        const [_, __, collection, docId] = path;
        
        // Get idToken from headers
        let idToken = null;
        const authHeader = req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          idToken = authHeader.substring(7);
        }
        
        console.log('[Worker] Deleting document:', collection, docId);
        console.log('[Worker] idToken present:', !!idToken);
        
        // Special handling for friends collection
        if (collection === "friends" && idToken) {
          try {
            // Verify token and get current user
            console.log('[Worker] Verifying token for deletion...');
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          }
        );
        const verifyData = await verifyRes.json();
            const currentUserId = verifyData.users?.[0]?.localId;
  
            console.log('[Worker] Current user ID:', currentUserId);
  
            if (!currentUserId) {
              return new Response(JSON.stringify({ error: "Invalid token" }), { 
                status: 401, 
                headers: { "Content-Type": "application/json" } 
              });
            }
  
            // Fetch the document to check if user is user_1 or user_2
            const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${docId}`;
            console.log('[Worker] Fetching friend document from:', getUrl);
            
            const getRes = await fetch(getUrl, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
              }
            });
  
            console.log('[Worker] Get friend doc status:', getRes.status);
  
            if (!getRes.ok) {
              const errorText = await getRes.text();
              console.error('[Worker] Failed to fetch friend document:', getRes.status, errorText);
              return new Response(JSON.stringify({ 
                error: "Friend request not found or access denied",
                status: getRes.status,
                details: errorText
              }), { 
                status: getRes.status,
                headers: { "Content-Type": "application/json" } 
              });
            }
  
            const existingDoc = await getRes.json();
            const user1 = existingDoc.fields?.user_1?.stringValue;
            const user2 = existingDoc.fields?.user_2?.stringValue;
            
            console.log('[Worker] Friend document:', { user1, user2, currentUserId });
            
            // Allow deletion if current user is either user_1 or user_2
            if (currentUserId !== user1 && currentUserId !== user2) {
              return new Response(JSON.stringify({ 
                error: "Permission denied: not authorized to delete this friend request",
                details: { currentUserId, user1, user2 }
              }), { 
                status: 403,
                headers: { "Content-Type": "application/json" } 
              });
            }
            
            console.log('[Worker] User authorized to delete friend request');
          } catch (error) {
            console.error('[Worker] Delete friends error:', error);
            return new Response(JSON.stringify({ error: error.message }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
        }
        
        // Prepare URL and headers
        const headers = { "Content-Type": "application/json" };
        let firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
        
        if (idToken) {
          headers["Authorization"] = `Bearer ${idToken}`;
          console.log('[Worker] Using authenticated DELETE with idToken');
        } else {
          firestoreUrl += `?key=${apiKey}`;
          console.log('[Worker] Using unauthenticated DELETE with API key');
        }
        
        const res = await fetch(firestoreUrl, {
          method: "DELETE",
          headers: headers
        });
        
        const responseText = await res.text();
        console.log('[Worker] Delete response status:', res.status);
        
        if (res.ok) {
          return new Response(JSON.stringify({ 
            status: "✅ Document deleted", 
            collection, 
            docId 
          }), { 
            status: 200,
            headers: { "Content-Type": "application/json" } 
          });
        } else {
          console.log('[Worker] Delete error:', responseText);
          return new Response(responseText, { 
            status: res.status,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- LOGOUT ----------------
      if (url.pathname === "/logout" && req.method === "POST") {
        // On peut juste retourner un succès pour le client
        return new Response(JSON.stringify({
          status: "✅ Déconnecté côté serveur",
          message: "Supprimez le idToken et refreshToken côté client"
        }), { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- LOGIN ----------------
      if (url.pathname === "/login" && req.method === "POST") {
        const { email, password } = await req.json();
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true })
          }
        );
        
        const responseText = await res.text();
        console.log('[Worker] Login response text:', responseText);
        
        // If account is disabled, try to fetch the reason from Firestore
        if (responseText.includes('USER_DISABLED')) {
          try {
            console.log('[Worker] Account disabled detected, fetching reason...');
            
            // 1. Get userId from email using Firebase Auth lookup
            console.log('[Worker] Attempting to lookup user by email:', email);
            const lookupRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: [email] })
              }
            );
            const lookupData = await lookupRes.json();
            console.log('[Worker] Lookup response:', JSON.stringify(lookupData));
            
            if (lookupData.users && lookupData.users[0]) {
              const userId = lookupData.users[0].localId;
              console.log('[Worker] Found userId:', userId);
              
              // 2. Fetch user document from Firestore
              const userDocRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`
              );
              
              if (userDocRes.ok) {
                const userDoc = await userDocRes.json();
                const disableReason = userDoc.fields?.disableReason?.stringValue || userDoc.fields?.reason?.stringValue;
                
                if (disableReason) {
                  console.log('[Worker] Found disable reason:', disableReason);
                  
                  // Modify the error response to include the reason
                  const errorData = JSON.parse(responseText);
                  if (!errorData.error) {
                    errorData.error = { message: 'USER_DISABLED' };
                  }
                  errorData.error.disableReason = disableReason;
                  
                  console.log('[Worker] Sending modified error with reason:', JSON.stringify(errorData));
                  
                  return new Response(JSON.stringify(errorData), { 
                    status: 400, // Ensure it's treated as an error
                    headers: { "Content-Type": "application/json" } 
                  });
                }
              }
            }
          } catch (err) {
            console.error('[Worker] Error fetching disable reason:', err);
          }
        }
        
        return new Response(responseText, { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- REGISTER ----------------
      if (url.pathname === "/register" && req.method === "POST") {
        const { email, password, username } = await req.json();
        
        // 1. Créer le compte Firebase Auth
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true })
          }
        );
        
        const authData = await res.json();
        
        if (res.ok && authData.localId) {
          // 2. Créer le document utilisateur dans Firestore
          const userId = authData.localId;
          const now = new Date().toISOString();
          
          const userDoc = {
            fields: {
              createdAt: { timestampValue: now },
              photoURL: { stringValue: "https://files.catbox.moe/xry0hs.png" },
              username: { stringValue: username || "User" }
            }
          };
          
          console.log('[Worker] Creating user document for:', userId);
          
          // Créer le document dans Firestore avec le userId comme ID
          const userRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`,
            {
              method: "PATCH",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authData.idToken}`
              },
              body: JSON.stringify(userDoc)
            }
          );
          
          if (userRes.ok) {
            console.log('[Worker] User document created successfully');
          } else {
            const errorText = await userRes.text();
            console.error('[Worker] Error creating user document:', errorText);
          }
        }
        
        return new Response(JSON.stringify(authData), { 
          status: res.status,
          headers: { "Content-Type": "application/json" } 
        });
      }
  
      // ---------------- RESET PASSWORD ----------------
      if (url.pathname === "/reset-password" && req.method === "POST") {
        const { email } = await req.json();
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
          }
        );
        return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- GET FILE DOWNLOAD LINK ----------------
      if (url.pathname === "/get-file-link" && req.method === "POST") {
        try {
          const { modId, fileId } = await req.json();
          
          if (!modId || !fileId) {
            return new Response(JSON.stringify({ error: "modId and fileId required" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] Fetching file link for mod:', modId, 'file:', fileId);
          
          // Fetch mod data from GameBanana with full file details
          const gbApiUrl = `https://gamebanana.com/apiv11/Mod/${modId}?_csvProperties=_aFiles`;
          const gbResponse = await fetch(gbApiUrl);
          
          if (!gbResponse.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch from GameBanana" }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const gbData = await gbResponse.json();
          
          // Find the selected file
          const selectedFile = gbData._aFiles.find(f => String(f._idRow) === String(fileId));
          
          if (!selectedFile) {
            return new Response(JSON.stringify({ error: "File not found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] Found file:', selectedFile._sFile);
          
          // Look for FightPlanner download link
          let fightPlannerLink = null;
          
          if (selectedFile._sDownloadUrl) {
            const downloadUrl = selectedFile._sDownloadUrl;
            console.log('[Worker] Download URL:', downloadUrl);
            
            // Extract the download ID from the URL (e.g., 1169045 from /dl/1169045)
            const dlIdMatch = downloadUrl.match(/\/dl\/(\d+)/);
            if (dlIdMatch) {
              const dlId = dlIdMatch[1];
              
              // Construct fightplanner: link
              // Format: fightplanner:https://gamebanana.com/mmdl/{dlId},Mod,{modId},{extension}
              const fileExtension = selectedFile._sFile.split('.').pop() || '7z';
              fightPlannerLink = `fightplanner:https://gamebanana.com/mmdl/${dlId},Mod,${modId},${fileExtension}`;
              
              console.log('[Worker] Generated FightPlanner link:', fightPlannerLink);
            }
          }
          
          if (!fightPlannerLink) {
            return new Response(JSON.stringify({ error: "No FightPlanner download link found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          return new Response(JSON.stringify({ 
            link: fightPlannerLink,
            fileName: selectedFile._sFile
          }), { 
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (error) {
          console.error('[Worker] Get file link error:', error);
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      if (path[1] === "list" && req.method === "GET") {
        const [_, __, collection] = path;
      
        // Get currentUserId and username if idToken is present in query params
        let currentUserId = null;
        let currentUsername = null;
        const idToken = url.searchParams.get('idToken');
        if (idToken) {
          try {
            const verifyRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
              }
            );
            const verifyData = await verifyRes.json();
            currentUserId = verifyData.users?.[0]?.localId;
            
            // Fetch username from users collection
            if (currentUserId) {
              try {
                const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${currentUserId}`;
                const userDocRes = await fetch(userDocUrl);
                if (userDocRes.ok) {
                  const userDoc = await userDocRes.json();
                  currentUsername = userDoc.fields?.username?.stringValue || null;
                  console.log('[Worker] Current user:', currentUserId, currentUsername);
                }
              } catch (userError) {
                console.error('[Worker] Error fetching username:', userError);
              }
            }
          } catch (error) {
            console.error('[Worker] Error verifying token:', error);
          }
        }
      
        // Firestore REST API : liste tous les docs d'une collection
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`
        );
      
        const data = await res.json();
      
        // Transforme les documents pour avoir juste un tableau avec id + fields lisibles
        let docs = (data.documents || []).map(doc => {
          const id = doc.name.split("/").pop();
          const fields = Object.fromEntries(
            Object.entries(doc.fields || {}).map(([k, v]) => [k, Object.values(v)[0]])
          );
          return { id, ...fields };
        });
        
        // Filter mods based on privacy settings for the "links" collection
        if (collection === "links") {
          console.log('[Worker] Filtering mods with privacy. currentUserId:', currentUserId, 'currentUsername:', currentUsername);
          
          // Fetch all users to get their privacy settings
          const usersRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`
          );
          const usersData = await usersRes.json();
          
          // Create a map of userId -> privacySettings AND username -> privacySettings
          const userPrivacyMap = new Map(); // userId -> privacy
          const usernamePrivacyMap = new Map(); // username -> privacy
          (usersData.documents || []).forEach(doc => {
            const userId = doc.name.split("/").pop();
            const username = doc.fields?.username?.stringValue;
            const privacySettings = doc.fields?.privacySettings?.mapValue?.fields;
            if (privacySettings) {
              const privacy = {
                modsVisibility: privacySettings.modsVisibility?.stringValue || 'global',
                allowSync: privacySettings.allowSync?.booleanValue !== false
              };
              userPrivacyMap.set(userId, privacy);
              if (username) {
                usernamePrivacyMap.set(username, privacy);
              }
            }
          });
          
          // Fetch friend relations if currentUserId exists
          let friendIds = new Set(); // userId -> userId relations
          let friendUsernames = new Set(); // username of friends
          if (currentUserId) {
            try {
              const friendsRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends`
              );
              const friendsData = await friendsRes.json();
              (friendsData.documents || []).forEach(doc => {
                const user1 = doc.fields?.user_1?.stringValue;
                const user2 = doc.fields?.user_2?.stringValue;
                const status = doc.fields?.status?.stringValue;
                
                if (status === 'accepted') {
                  if (user1 === currentUserId) friendIds.add(user2);
                  if (user2 === currentUserId) friendIds.add(user1);
                }
              });
              
              // Resolve friend usernames
              for (const friendId of friendIds) {
                const friendUser = (usersData.documents || []).find(doc => doc.name.endsWith(`/${friendId}`));
                if (friendUser) {
                  const friendUsername = friendUser.fields?.username?.stringValue;
                  if (friendUsername) friendUsernames.add(friendUsername);
                }
              }
            } catch (error) {
              console.error('[Worker] Error fetching friends:', error);
            }
          }
          
          docs = docs.filter(doc => {
            const modUserId = doc.userId;
            const modUsername = doc.pseudo;
            
            // Check if current user is the owner
            const isOwnerByUserId = currentUserId && modUserId === currentUserId;
            const isOwnerByUsername = currentUsername && modUsername === currentUsername;
            const isOwner = isOwnerByUserId || isOwnerByUsername;
            
            // Always show own mods to the owner
            if (isOwner) {
              return true;
            }
            
            // Hide mods marked as hidden
            if (doc.isHidden === true) {
              console.log('[Worker] ❌ Hiding individually hidden mod:', doc.mod_name);
              return false;
            }
            
            // Check privacy settings (by userId or username)
            let privacy = userPrivacyMap.get(modUserId);
            if (!privacy && modUsername) {
              privacy = usernamePrivacyMap.get(modUsername);
            }
            
            if (privacy) {
              const visibility = privacy.modsVisibility;
              
              if (visibility === 'none') {
                console.log('[Worker] ❌ Hiding mod (owner set to "Only Me"):', doc.mod_name);
                return false;
              }
              
              if (visibility === 'friends') {
                // Check friendship by userId or username
                const isFriendById = currentUserId && modUserId && friendIds.has(modUserId);
                const isFriendByUsername = modUsername && friendUsernames.has(modUsername);
                const isFriend = isFriendById || isFriendByUsername;
                
                if (!isFriend) {
                  console.log('[Worker] ❌ Hiding mod (owner set to "Friends Only" and not friends):', doc.mod_name);
                  return false;
                }
              }
              
              // visibility === 'global' -> show to everyone
            }
            
            return true;
          });
          
          console.log('[Worker] After filtering:', docs.length, 'mods visible');
        }
      
        return new Response(JSON.stringify(docs), { headers: { "Content-Type": "application/json" } });
      }
  
      if (url.pathname === "/links-friends" && req.method === "POST") {
        try {
          const { idToken } = await req.json();
      
          if (!idToken) {
            return new Response(JSON.stringify({ error: "idToken manquant" }), { status: 401, headers: { "Content-Type": "application/json" } });
          }
      
          // 1️⃣ Vérifier et décoder le token pour obtenir l'uid
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
      
          const verifyData = await verifyRes.json();
          const uid = verifyData.users?.[0]?.localId;
      
          if (!uid) {
            return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: { "Content-Type": "application/json" } });
          }
      
          // 2️⃣ Lire toute la collection friends
          const res = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends`
          );
          const data = await res.json();
      
          if (data.error) {
            return new Response(JSON.stringify({ error: data.error.message || "Erreur Firestore" }), { status: 500, headers: { "Content-Type": "application/json" } });
          }
      
          // 3️⃣ Filtrer côté Worker : user_1 ou user_2 == uid
          const friendDocs = (data.documents || []).filter(doc => {
            const fields = doc.fields || {};
            return fields.user_1?.stringValue === uid || fields.user_2?.stringValue === uid;
          });
          
          // 4️⃣ Récupérer les infos utilisateur pour chaque ami
          const usersRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`
          );
          const usersData = await usersRes.json();
          const usersMap = new Map();
          (usersData.documents || []).forEach(doc => {
            const userId = doc.name.split("/").pop();
            const fields = doc.fields || {};
            const username = fields.username?.stringValue || '';
            const photoURL = fields.photoURL?.stringValue || '';
            usersMap.set(userId, { username, photoURL });
          });
          
          // 5️⃣ Mapper les amis avec leurs infos utilisateur
          const friends = friendDocs.map(doc => {
            const id = doc.name.split("/").pop();
            const fields = Object.fromEntries(
              Object.entries(doc.fields || {}).map(([k, v]) => [k, Object.values(v)[0]])
            );
            
            const user1 = fields.user_1 || fields.user1;
            const user2 = fields.user_2 || fields.user2;
            const friendUserId = user1 === uid ? user2 : user1;
            
            // Enrichir avec les infos utilisateur
            const userInfo = usersMap.get(friendUserId);
            if (userInfo) {
              fields.username = userInfo.username;
              fields.friendUsername = userInfo.username;
              fields.photoURL = userInfo.photoURL;
              fields.friendId = friendUserId;
            }
            
            return { id, ...fields };
          });
          
          return new Response(JSON.stringify({ status: "✅ Success", friends }), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
      
      
      
      // ---------------- UPDATE USERNAME ----------------
      if (url.pathname === "/update-username" && req.method === "POST") {
        const { idToken, username } = await req.json();
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken, displayName: username, returnSecureToken: true })
          }
        );
        return new Response(await res.text(), { headers: { "Content-Type": "application/json" } });
      }
  
      // ---------------- ACCEPT FRIEND REQUEST ----------------
      if (url.pathname === "/accept-friend-request" && req.method === "POST") {
        try {
          const { requestId, idToken } = await req.json();
          
          console.log('[Worker] Accepting friend request:', requestId);
          
          if (!requestId || !idToken) {
            return new Response(JSON.stringify({ error: "requestId et idToken requis" }), { 
              status: 400, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Vérifier le token et obtenir l'uid de l'utilisateur authentifié
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
  
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
  
          if (!currentUserId) {
            return new Response(JSON.stringify({ error: "Token invalide" }), { 
              status: 401, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          console.log('[Worker] Current user ID:', currentUserId);
  
          // D'abord, récupérer le document existant
          const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${requestId}`;
          const getRes = await fetch(getUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            }
          });
  
          if (!getRes.ok) {
            const errorText = await getRes.text();
            console.error('[Worker] Failed to get friend request:', errorText);
            return new Response(errorText, {
              status: getRes.status,
              headers: { "Content-Type": "application/json" }
            });
          }
  
          const existingDoc = await getRes.json();
          console.log('[Worker] Existing document:', existingDoc);
          
          const user1 = existingDoc.fields?.user_1?.stringValue;
          const user2 = existingDoc.fields?.user_2?.stringValue;
          
          console.log('[Worker] user_1:', user1);
          console.log('[Worker] user_2:', user2);
          console.log('[Worker] currentUserId:', currentUserId);
  
          // Vérifier que l'utilisateur authentifié est bien user_2
          if (currentUserId !== user2) {
            return new Response(JSON.stringify({ 
              error: "Seul user_2 peut accepter cette demande",
              currentUserId,
              user2 
            }), { 
              status: 403, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Préparer les données complètes pour la mise à jour
          const updateData = {
            name: `projects/${projectId}/databases/(default)/documents/friends/${requestId}`,
            fields: {
              status: { stringValue: 'accepted' },
              user_1: existingDoc.fields.user_1,
              user_2: existingDoc.fields.user_2,
              createdAt: existingDoc.fields.createdAt
            }
          };
  
          console.log('[Worker] Updating friend request with complete data');
  
          // Utiliser PATCH avec le nom complet du document
          const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${requestId}?updateMask.fieldPaths=status&currentDocument.exists=true`;
          const res = await fetch(updateUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              fields: {
                status: { stringValue: 'accepted' }
              }
            })
          });
  
          const responseText = await res.text();
          console.log('[Worker] Accept friend response status:', res.status);
          console.log('[Worker] Accept friend response:', responseText);
  
          if (res.ok) {
            // Vérifier que la mise à jour a bien été effectuée
            const verifyRes = await fetch(getUrl, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
              }
            });
            
            if (verifyRes.ok) {
              const updatedDoc = await verifyRes.json();
              const currentStatus = updatedDoc.fields?.status?.stringValue;
              console.log('[Worker] Verification - Current status in DB:', currentStatus);
              
              if (currentStatus === 'accepted') {
                return new Response(JSON.stringify({ 
                  status: "✅ Demande d'ami acceptée",
                  requestId,
                  verifiedStatus: currentStatus
                }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                });
              } else {
                console.error('[Worker] Status not updated! Still:', currentStatus);
                return new Response(JSON.stringify({ 
                  error: "La mise à jour a échoué - le status n'a pas changé",
                  currentStatus,
                  expectedStatus: 'accepted'
                }), {
                  status: 500,
                  headers: { "Content-Type": "application/json" }
                });
              }
            }
            
            return new Response(JSON.stringify({ 
              status: "✅ Demande d'ami acceptée",
              requestId 
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          } else {
            console.error('[Worker] Accept friend error:', responseText);
            return new Response(responseText, {
              status: res.status,
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch (err) {
          console.error('[Worker] Accept friend exception:', err);
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- REJECT FRIEND REQUEST ----------------
      if (url.pathname === "/reject-friend-request" && req.method === "POST") {
        try {
          const { requestId, idToken } = await req.json();
          
          console.log('[Worker] Rejecting friend request:', requestId);
          
          if (!requestId || !idToken) {
            return new Response(JSON.stringify({ error: "requestId et idToken requis" }), { 
              status: 400, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Construire l'URL Firestore pour supprimer la demande
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${requestId}`;
          const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          };
  
          console.log('[Worker] Deleting rejected friend request');
  
          const res = await fetch(firestoreUrl, {
            method: "DELETE",
            headers: headers
          });
  
          const responseText = await res.text();
          console.log('[Worker] Reject friend response:', res.status, responseText);
  
          if (res.ok) {
            return new Response(JSON.stringify({ 
              status: "✅ Demande d'ami refusée",
              requestId 
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          } else {
            console.error('[Worker] Reject friend error:', responseText);
            return new Response(responseText, {
              status: res.status,
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch (err) {
          console.error('[Worker] Reject friend exception:', err);
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- CREATE FRIEND REQUEST ----------------
      if (url.pathname === "/create-friend-request" && req.method === "POST") {
        try {
          const { currentUserId, targetUserId, status, idToken } = await req.json();
          
          console.log('[Worker] Creating friend request:', { currentUserId, targetUserId, status });
          
          if (!currentUserId || !targetUserId) {
            return new Response(JSON.stringify({ error: "currentUserId et targetUserId requis" }), { 
              status: 400, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          if (!idToken) {
            return new Response(JSON.stringify({ error: "idToken requis pour créer une demande d'ami" }), { 
              status: 401, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Créer un ID unique pour la demande d'ami
          const friendRequestId = `friend_${currentUserId}_${targetUserId}_${Date.now()}`;
          
          // Préparer les données (user_1 doit être l'utilisateur authentifié selon les règles Firestore)
          const friendRequestData = {
            fields: {
              status: { stringValue: status || 'pending' },
              user_1: { stringValue: currentUserId },
              user_2: { stringValue: targetUserId },
              createdAt: { timestampValue: new Date().toISOString() }
            }
          };
  
          // Utiliser la collection 'friends' comme défini dans les règles Firestore
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${friendRequestId}`;
          const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          };
  
          console.log('[Worker] Using authenticated request for friend request in collection friends');
  
          // Créer la demande d'ami dans Firestore
          const res = await fetch(firestoreUrl, {
            method: "PATCH",
            headers: headers,
            body: JSON.stringify(friendRequestData)
          });
  
          const responseText = await res.text();
          console.log('[Worker] Friend request response:', res.status, responseText);
  
          if (res.ok) {
            return new Response(JSON.stringify({ 
              status: "✅ Demande d'ami créée",
              friendRequestId 
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          } else {
            console.error('[Worker] Friend request error:', responseText);
            return new Response(responseText, {
              status: res.status,
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch (err) {
          console.error('[Worker] Friend request exception:', err);
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- TOGGLE FRIEND SYNC ----------------
      if (url.pathname === "/toggle-friend-sync" && req.method === "POST") {
        try {
          const { friendId, synced, idToken } = await req.json();
          
          console.log('[Worker] Toggling friend sync:', friendId, synced);
          
          if (!friendId || synced === undefined || !idToken) {
            return new Response(JSON.stringify({ error: "friendId, synced et idToken requis" }), { 
              status: 400, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Vérifier le token pour obtenir l'UID
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
  
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
  
          if (!currentUserId) {
            return new Response(JSON.stringify({ error: "Token invalide" }), { 
              status: 401, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Récupérer le document existant
          const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${friendId}`;
          const getRes = await fetch(getUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            }
          });
  
          if (!getRes.ok) {
            const errorText = await getRes.text();
            console.error('[Worker] Failed to get friend document:', errorText);
            return new Response(errorText, {
              status: getRes.status,
              headers: { "Content-Type": "application/json" }
            });
          }
  
          const existingDoc = await getRes.json();
          const user1 = existingDoc.fields?.user_1?.stringValue;
          const user2 = existingDoc.fields?.user_2?.stringValue;
          
          // Déterminer quel champ mettre à jour
          const fieldToUpdate = currentUserId === user1 ? 'user_1_synced' : 'user_2_synced';
          
          console.log('[Worker] Updating', fieldToUpdate, 'to', synced);
          
          // Mettre à jour le champ approprié
          const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${friendId}?updateMask.fieldPaths=${fieldToUpdate}&currentDocument.exists=true`;
          const res = await fetch(updateUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              fields: {
                [fieldToUpdate]: { booleanValue: synced }
              }
            })
          });
  
          const responseText = await res.text();
          console.log('[Worker] Toggle sync response:', res.status, responseText);
  
          if (res.ok) {
            return new Response(JSON.stringify({ 
              status: synced ? "✅ Synchronisation activée" : "❌ Synchronisation désactivée",
              friendId,
              synced
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          } else {
            console.error('[Worker] Toggle sync error:', responseText);
            return new Response(responseText, {
              status: res.status,
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch (err) {
          console.error('[Worker] Toggle sync exception:', err);
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- SYNC FRIEND MODS ----------------
      if (url.pathname === "/sync-friend-mods" && req.method === "POST") {
        try {
          const { friendUserId, friendUsername, currentUserId, idToken } = await req.json();
          
          console.log('[Worker] Syncing mods from friend:', friendUsername);
          
          if (!friendUserId || !friendUsername || !currentUserId || !idToken) {
            return new Response(JSON.stringify({ error: "All parameters required" }), { 
              status: 400, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Check if friend allows sync
          const friendUserRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${friendUserId}`
          );
          const friendUserData = await friendUserRes.json();
          const privacySettings = friendUserData.fields?.privacySettings?.mapValue?.fields;
          const allowSync = privacySettings?.allowSync?.booleanValue !== false; // Default true if not set
          
          if (!allowSync) {
            console.log('[Worker] ❌ Friend has disabled mod sync');
            return new Response(JSON.stringify({ 
              error: "This user has disabled mod synchronization",
              copiedCount: 0,
              skippedCount: 0,
              totalMods: 0
            }), { 
              status: 403, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Récupérer tous les liens
          const linksUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/links`;
          const linksRes = await fetch(linksUrl);
          const linksData = await linksRes.json();
  
          if (!linksRes.ok) {
            return new Response(JSON.stringify({ error: "Impossible de récupérer les mods" }), { 
              status: 500, 
              headers: { "Content-Type": "application/json" } 
            });
          }
  
          // Filtrer les mods de l'ami (exclure les mods cachés)
          const friendMods = (linksData.documents || []).filter(doc => {
            const fields = doc.fields || {};
            const isPseudoMatch = fields.pseudo?.stringValue === friendUsername;
            const isHidden = fields.isHidden?.booleanValue === true;
            
            // Only include mods that match username AND are not hidden
            return isPseudoMatch && !isHidden;
          });
  
          console.log('[Worker] Found', friendMods.length, 'public mods from friend (hidden mods excluded)');
  
          // Get current user's username
          const userRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${currentUserId}`
          );
          const userData = await userRes.json();
          const currentUsername = userData.fields?.username?.stringValue || "User";
  
          // Get current user's existing mods to check for duplicates
          const currentUserMods = (linksData.documents || []).filter(doc => {
            const fields = doc.fields || {};
            return fields.pseudo?.stringValue === currentUsername;
          });
  
          // Create a Set of existing mod links for quick lookup
          const existingModLinks = new Set(
            currentUserMods.map(doc => doc.fields?.link?.stringValue).filter(Boolean)
          );
  
          console.log('[Worker] User already has', existingModLinks.size, 'mods');
  
          // Copy each mod with new username
          const copiedMods = [];
          const skippedMods = [];
          
          for (const mod of friendMods) {
            const modLink = mod.fields?.link?.stringValue;
            const modName = mod.fields?.mod_name?.stringValue || 'unknown';
            
            // Skip if user already has this mod
            if (modLink && existingModLinks.has(modLink)) {
              console.log('[Worker] Skipping duplicate mod:', modName);
              skippedMods.push(modName);
              continue;
            }
            
            // Create unique ID based on mod link instead of original ID
            const linkHash = modLink ? modLink.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) : '';
            const newModId = `sync_${currentUserId}_${linkHash}_${Date.now()}`;
            
            // Create new document with current user's username and NEW ID
            const newModData = {
              fields: {
                ...mod.fields,
                id: { stringValue: newModId },  // IMPORTANT: Replace the old ID with the new one
                pseudo: { stringValue: currentUsername },
                syncedFrom: { stringValue: friendUsername },
                modInstalled: { booleanValue: false }  // Reset to false - user hasn't installed it yet
              }
            };
  
            const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/links?documentId=${newModId}`;
            const createRes = await fetch(createUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
              },
              body: JSON.stringify(newModData)
            });
  
            if (createRes.ok) {
              copiedMods.push(modName);
            } else {
              console.error('[Worker] Failed to copy mod:', modName);
            }
          }
  
          // Create notification for the friend that someone synced their mods
          if (copiedMods.length > 0) {
            try {
              const notificationId = `notif_sync_${friendUserId}_${Date.now()}`;
              const notificationData = {
                fields: {
                  type: { stringValue: "mod_sync" },
                  userId: { stringValue: friendUserId },
                  fromUserId: { stringValue: currentUserId },
                  fromUsername: { stringValue: currentUsername },
                  message: { stringValue: `${currentUsername} synchronized ${copiedMods.length} of your mods` },
                  createdAt: { timestampValue: new Date().toISOString() },
                  read: { booleanValue: false }
                }
              };
              
              const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications?documentId=${notificationId}`;
              await fetch(notifUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify(notificationData)
              });
              
              console.log('[Worker] Notification created for friend:', friendUserId);
            } catch (notifError) {
              console.error('[Worker] Failed to create notification:', notifError);
              // Don't fail the whole sync if notification fails
            }
          }
  
          return new Response(JSON.stringify({ 
            status: "✅ Mods synchronized",
            copiedCount: copiedMods.length,
            skippedCount: skippedMods.length,
            totalMods: friendMods.length,
            message: skippedMods.length > 0 
              ? `${copiedMods.length} mods synced, ${skippedMods.length} already in your library`
              : `${copiedMods.length} mods synced successfully`
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
  
        } catch (err) {
          console.error('[Worker] Sync mods exception:', err);
          return new Response(JSON.stringify({ error: err.message || "Erreur inconnue" }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- GET NOTIFICATIONS ----------------
      if (url.pathname === "/get-notifications" && req.method === "POST") {
        try {
          const { idToken } = await req.json();
          
          if (!idToken) {
            return new Response(JSON.stringify({ error: "idToken required" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Verify token and get userId
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
          
          if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: "Invalid token" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const verifyData = await verifyRes.json();
          const userId = verifyData.users?.[0]?.localId;
          
          if (!userId) {
            return new Response(JSON.stringify({ error: "User not found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Fetch all notifications for this user
          const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`;
          const notifRes = await fetch(notifUrl, {
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          });
          
          if (!notifRes.ok) {
            console.error('[Worker] Failed to fetch notifications:', notifRes.status);
            return new Response(JSON.stringify({ notifications: [] }), { 
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const notifData = await notifRes.json();
          
          // Filter notifications for this user and transform to readable format
          const notifications = (notifData.documents || [])
            .map(doc => {
              const id = doc.name.split("/").pop();
              const fields = Object.fromEntries(
                Object.entries(doc.fields || {}).map(([k, v]) => [k, Object.values(v)[0]])
              );
              return { id, ...fields };
            })
            .filter(notif => notif.userId === userId)
            .sort((a, b) => {
              const dateA = new Date(a.createdAt || 0);
              const dateB = new Date(b.createdAt || 0);
              return dateB.getTime() - dateA.getTime(); // Most recent first
            });
          
          console.log('[Worker] Found notifications:', notifications.length);
          
          return new Response(JSON.stringify({ notifications }), { 
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (err) {
          console.error('[Worker] Get notifications error:', err);
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- MARK NOTIFICATION AS READ ----------------
      if (url.pathname === "/mark-notification-read" && req.method === "POST") {
        try {
          const { notificationId, idToken } = await req.json();
          
          if (!notificationId || !idToken) {
            return new Response(JSON.stringify({ error: "notificationId and idToken required" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Verify token
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
          
          if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: "Invalid token" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
          
          if (!currentUserId) {
            return new Response(JSON.stringify({ error: "User not found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] Current user ID:', currentUserId);
          
          // First, fetch the notification to verify ownership
          const getNotifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications/${notificationId}`;
          const getNotifRes = await fetch(getNotifUrl, {
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          });
          
          if (!getNotifRes.ok) {
            const errorText = await getNotifRes.text();
            console.error('[Worker] Failed to fetch notification:', errorText);
            return new Response(JSON.stringify({ error: "Notification not found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const notifData = await getNotifRes.json();
          const notifUserId = notifData.fields?.userId?.stringValue;
          
          console.log('[Worker] Notification userId:', notifUserId);
          
          // Verify that the notification belongs to the current user
          if (notifUserId !== currentUserId) {
            return new Response(JSON.stringify({ error: "Permission denied: not your notification" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Update notification to mark as read using API key (admin access)
          const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications/${notificationId}?updateMask.fieldPaths=read&key=${apiKey}`;
          const updateRes = await fetch(notifUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              fields: {
                read: { booleanValue: true }
              }
            })
          });
          
          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error('[Worker] Failed to mark notification as read:', errorText);
            return new Response(JSON.stringify({ error: "Failed to update notification", details: errorText }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] ✅ Notification marked as read successfully');
          
          return new Response(JSON.stringify({ success: true }), { 
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (err) {
          console.error('[Worker] Mark notification read error:', err);
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- UPDATE USER PRIVACY ----------------
      if (url.pathname === "/update-user-privacy" && req.method === "POST") {
        try {
          const { userId, idToken, privacySettings } = await req.json();
          
          if (!userId || !idToken || !privacySettings) {
            return new Response(JSON.stringify({ error: "Missing parameters" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Verify token
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
          
          if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: "Invalid token" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
          
          if (currentUserId !== userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Update user document with privacy settings
          const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=privacySettings`;
          const updateRes = await fetch(userDocUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              fields: {
                privacySettings: {
                  mapValue: {
                    fields: {
                      allowSync: { booleanValue: privacySettings.allowSync },
                      modsVisibility: { stringValue: privacySettings.modsVisibility }
                    }
                  }
                }
              }
            })
          });
          
          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error('[Worker] Failed to update privacy settings:', errorText);
            return new Response(JSON.stringify({ error: "Failed to update settings" }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          return new Response(JSON.stringify({ success: true }), { 
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (err) {
          console.error('[Worker] Update privacy error:', err);
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- FIX USER DATA (Emergency) ----------------
      if (url.pathname === "/fix-user-data" && req.method === "POST") {
        try {
          const { userId, idToken, username } = await req.json();
          
          if (!userId || !idToken || !username) {
            return new Response(JSON.stringify({ error: "Missing parameters" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Verify token
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
          
          if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: "Invalid token" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
          
          if (currentUserId !== userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Restore missing user data
          const userDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
          const updateRes = await fetch(userDocUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              fields: {
                username: { stringValue: username },
                photoURL: { stringValue: "https://files.catbox.moe/xry0hs.png" },
                createdAt: { timestampValue: new Date().toISOString() }
              }
            })
          });
          
          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error('[Worker] Failed to fix user data:', errorText);
            return new Response(JSON.stringify({ error: "Failed to restore data" }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          return new Response(JSON.stringify({ success: true, message: "User data restored" }), { 
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (err) {
          console.error('[Worker] Fix user data error:', err);
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- DELETE ACCOUNT (PERMANENT) ----------------
      if (url.pathname === "/delete-account" && req.method === "POST") {
        try {
          const { userId, idToken, confirmationText } = await req.json();
          
          if (!userId || !idToken || confirmationText !== 'DELETE MY ACCOUNT') {
            return new Response(JSON.stringify({ error: "Invalid confirmation or missing parameters" }), { 
              status: 400,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] 🚨 Account deletion requested for user:', userId);
          
          // Verify token
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            }
          );
          
          if (!verifyRes.ok) {
            return new Response(JSON.stringify({ error: "Invalid token" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          const verifyData = await verifyRes.json();
          const currentUserId = verifyData.users?.[0]?.localId;
          
          if (currentUserId !== userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          console.log('[Worker] ✅ User verified, starting account deletion process...');
          
          const deletionResults = {
            links: 0,
            friends: 0,
            notifications: 0,
            user: false,
            auth: false
          };
          
          // 1. Delete all user's links (by userId AND pseudo/username)
          try {
            // First, get the username
            let username = null;
            try {
              const userDocRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`
              );
              if (userDocRes.ok) {
                const userDoc = await userDocRes.json();
                username = userDoc.fields?.username?.stringValue;
              }
            } catch (err) {
              console.error('[Worker] Error fetching username for deletion:', err);
            }
            
            const linksRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/links`
            );
            const linksData = await linksRes.json();
            
            if (linksData.documents) {
              const deletePromises = [];
              for (const doc of linksData.documents) {
                const docUserId = doc.fields?.userId?.stringValue;
                const docPseudo = doc.fields?.pseudo?.stringValue;
                
                // Delete if matches userId OR username (for old mods)
                if (docUserId === userId || (username && docPseudo === username)) {
                  const docId = doc.name.split('/').pop();
                  const deleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/links/${docId}`;
                  deletePromises.push(
                    fetch(deleteUrl, { 
                      method: "DELETE",
                      headers: {
                        "Authorization": `Bearer ${idToken}`
                      }
                    })
                      .then(delRes => {
                        if (delRes.ok) {
                          deletionResults.links++;
                          console.log('[Worker] 🗑️ Deleted link:', docId);
                          return true;
                        } else {
                          console.error('[Worker] ❌ Failed to delete link:', docId, delRes.status);
                          return false;
                        }
                      })
                  );
                }
              }
              // Wait for ALL deletions to complete
              await Promise.all(deletePromises);
            }
            console.log('[Worker] 🗑️ Total deleted', deletionResults.links, 'links');
          } catch (err) {
            console.error('[Worker] Error deleting links:', err);
          }
          
          // 2. Delete all friend relations (where user_1 or user_2)
          try {
            const friendsRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends`
            );
            const friendsData = await friendsRes.json();
            
            console.log('[Worker] 👥 Checking friends collection...');
            
            if (friendsData.documents) {
              const deletePromises = [];
              for (const doc of friendsData.documents) {
                const user1 = doc.fields?.user_1?.stringValue;
                const user2 = doc.fields?.user_2?.stringValue;
                const docId = doc.name.split('/').pop();
                
                if (user1 === userId || user2 === userId) {
                  const deleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/friends/${docId}`;
                  deletePromises.push(
                    fetch(deleteUrl, { 
                      method: "DELETE",
                      headers: {
                        "Authorization": `Bearer ${idToken}`
                      }
                    })
                      .then(delRes => {
                        if (delRes.ok) {
                          deletionResults.friends++;
                          console.log('[Worker] 🗑️ Deleted friend relation:', docId, `(${user1} <-> ${user2})`);
                          return true;
                        } else {
                          console.error('[Worker] ❌ Failed to delete friend:', docId, delRes.status);
                          return false;
                        }
                      })
                  );
                }
              }
              // Wait for ALL deletions to complete
              await Promise.all(deletePromises);
            }
            console.log('[Worker] 🗑️ Total deleted', deletionResults.friends, 'friend relations');
          } catch (err) {
            console.error('[Worker] Error deleting friends:', err);
          }
          
          // 3. Delete all notifications (sent to or from user)
          try {
            const notifsRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`
            );
            const notifsData = await notifsRes.json();
            
            console.log('[Worker] 🔔 Checking notifications collection...');
            
            if (notifsData.documents) {
              const deletePromises = [];
              for (const doc of notifsData.documents) {
                const notifUserId = doc.fields?.userId?.stringValue;
                const fromUserId = doc.fields?.fromUserId?.stringValue;
                const docId = doc.name.split('/').pop();
                
                if (notifUserId === userId || fromUserId === userId) {
                  const deleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications/${docId}`;
                  deletePromises.push(
                    fetch(deleteUrl, { 
                      method: "DELETE",
                      headers: {
                        "Authorization": `Bearer ${idToken}`
                      }
                    })
                      .then(delRes => {
                        if (delRes.ok) {
                          deletionResults.notifications++;
                          console.log('[Worker] 🗑️ Deleted notification:', docId);
                          return true;
                        } else {
                          console.error('[Worker] ❌ Failed to delete notification:', docId, delRes.status);
                          return false;
                        }
                      })
                  );
                }
              }
              // Wait for ALL deletions to complete
              await Promise.all(deletePromises);
            }
            console.log('[Worker] 🗑️ Total deleted', deletionResults.notifications, 'notifications');
          } catch (err) {
            console.error('[Worker] Error deleting notifications:', err);
          }
          
          // 4. Delete user document
          try {
            console.log('[Worker] 👤 Deleting user document...');
            const deleteUserUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
            const delUserRes = await fetch(deleteUserUrl, { 
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${idToken}`
              }
            });
            if (delUserRes.ok) {
              deletionResults.user = true;
              console.log('[Worker] 🗑️ Deleted user document');
            } else {
              console.error('[Worker] ❌ Failed to delete user document:', delUserRes.status);
            }
          } catch (err) {
            console.error('[Worker] Error deleting user document:', err);
          }
          
          // Summary before deleting auth
          console.log('[Worker] 📊 Firestore deletion summary BEFORE auth deletion:', {
            links: deletionResults.links,
            friends: deletionResults.friends,
            notifications: deletionResults.notifications,
            user: deletionResults.user
          });
          
          // CHECK if Firestore deletions failed - if so, ABORT
          if (!deletionResults.user) {
            console.error('[Worker] ❌ ABORTING: Failed to delete user document from Firestore');
            return new Response(JSON.stringify({ 
              error: "Failed to delete user data from database. Account deletion aborted.",
              details: deletionResults
            }), { 
              status: 500,
              headers: { "Content-Type": "application/json" } 
            });
          }
          
          // Small delay to ensure all Firestore operations are committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 5. Delete Firebase Auth account (LAST STEP - only if Firestore deletions succeeded)
          try {
            console.log('[Worker] 🔐 Deleting Firebase Auth account...');
            const deleteAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`;
            const deleteAuthRes = await fetch(deleteAuthUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken })
            });
            
            if (deleteAuthRes.ok) {
              deletionResults.auth = true;
              console.log('[Worker] 🗑️ Deleted Firebase Auth account');
            } else {
              const errorText = await deleteAuthRes.text();
              console.error('[Worker] ❌ Failed to delete auth account:', deleteAuthRes.status, errorText);
            }
          } catch (err) {
            console.error('[Worker] Error deleting auth account:', err);
          }
          
          console.log('[Worker] ✅ Account deletion completed:', deletionResults);
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Account permanently deleted",
            results: deletionResults
          }), { 
            status: 200,
            headers: { "Content-Type": "application/json" } 
          });
          
        } catch (err) {
          console.error('[Worker] Delete account error:', err);
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
  
      // ---------------- ROUTE INCONNUE ----------------
      return new Response(JSON.stringify({ error: "Error 404. Sorryyy." }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
  }
  