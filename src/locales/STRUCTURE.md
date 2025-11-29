# 📁 Structure i18n FightPlanner

## Vue d'ensemble

```
FightPlanner 4/
│
├── crowdin.yml                          # Configuration Crowdin
├── I18N-QUICKSTART.md                   # Guide rapide (COMMENCEZ ICI!)
├── INTEGRATION-EXAMPLE.html             # Exemple d'intégration complète
│
├── src/
│   ├── locales/                         # 🌍 Fichiers de traduction
│   │   ├── en.json                      # Anglais (source)
│   │   ├── fr.json                      # Français
│   │   ├── i18n.js                      # Module Node.js (main process)
│   │   ├── README.md                    # Documentation complète
│   │   └── STRUCTURE.md                 # Ce fichier
│   │
│   └── renderer/
│       ├── css/
│       │   └── i18n.css                 # Styles pour sélecteur de langue
│       │
│       └── js/
│           └── i18n/                    # 🎨 Scripts front-end
│               ├── i18n-client.js       # Client i18n pour le renderer
│               └── language-selector.js # Composant sélecteur de langue
```

## 📄 Fichiers et leur rôle

### Fichiers de configuration

| Fichier | Description | Éditer? |
|---------|-------------|---------|
| `crowdin.yml` | Configuration Crowdin pour sync | ✅ Une fois |
| `I18N-QUICKSTART.md` | Guide d'installation rapide (5 min) | ❌ Lire |
| `INTEGRATION-EXAMPLE.html` | Exemple complet d'utilisation | ❌ Référence |

### Traductions

| Fichier | Description | Éditer? |
|---------|-------------|---------|
| `src/locales/en.json` | **Source de vérité** - Anglais | ✅ Toujours |
| `src/locales/fr.json` | Traductions françaises | ⚠️ Via Crowdin |
| `src/locales/[lang].json` | Autres langues | ⚠️ Via Crowdin |

> ⚠️ **Important** : Éditez uniquement `en.json` directement. Les autres langues doivent être gérées via Crowdin pour éviter les conflits.

### Code JavaScript

| Fichier | Contexte | Utilisation |
|---------|----------|-------------|
| `src/locales/i18n.js` | **Main Process** (Node.js) | Backend Electron |
| `src/renderer/js/i18n/i18n-client.js` | **Renderer Process** (Browser) | Interface utilisateur |
| `src/renderer/js/i18n/language-selector.js` | **UI Component** | Sélecteur de langue |

### Styles

| Fichier | Description |
|---------|-------------|
| `src/renderer/css/i18n.css` | Styles pour le sélecteur de langue |

### Documentation

| Fichier | Pour qui? | Contenu |
|---------|-----------|---------|
| `I18N-QUICKSTART.md` | 🚀 Débutants | Installation en 5 minutes |
| `src/locales/README.md` | 📚 Développeurs | Documentation complète |
| `INTEGRATION-EXAMPLE.html` | 💻 Développeurs | Exemples de code |
| `src/locales/STRUCTURE.md` | 🗂️ Tous | Ce fichier |

## 🔄 Workflow de développement

### Scénario 1: Ajouter une nouvelle traduction

```bash
1. Éditez src/locales/en.json
2. crowdin upload sources
3. Traduisez sur Crowdin
4. crowdin download
5. git commit
```

### Scénario 2: Intégrer i18n dans une nouvelle page

```html
1. Ajoutez les scripts:
   <script src="js/i18n/i18n-client.js"></script>

2. Initialisez:
   await i18n.init(i18n.getSavedLocale());

3. Marquez vos éléments:
   <button data-i18n="common.save">Save</button>
```

### Scénario 3: Ajouter une nouvelle langue

```bash
1. Créez src/locales/es.json (copiez en.json)
2. Ajoutez 'es' dans i18n-client.js availableLocales
3. (Optionnel) Ajoutez le drapeau dans language-selector.js
4. crowdin download
```

## 🎯 Checklist d'intégration

### Première installation (une seule fois)

- [ ] Lire `I18N-QUICKSTART.md`
- [ ] Vérifier que les fichiers JSON existent
- [ ] Tester `i18n-client.js` dans la console
- [ ] (Optionnel) Configurer Crowdin

### Pour chaque page HTML

- [ ] Inclure `i18n-client.js`
- [ ] Ajouter l'initialisation dans DOMContentLoaded
- [ ] Remplacer les textes par `data-i18n`
- [ ] Tester le changement de langue
- [ ] Vérifier que tout s'affiche correctement

### Pour chaque nouveau texte

- [ ] Ajouter la clé dans `en.json`
- [ ] Ajouter la traduction dans `fr.json` (ou via Crowdin)
- [ ] Utiliser `data-i18n="votre.cle"` dans le HTML
- [ ] Ou `i18n.t('votre.cle')` en JavaScript
- [ ] Tester avec les deux langues

## 🚀 Démarrage rapide

**Vous êtes pressé? Suivez ces 3 étapes:**

1. **Lisez** `I18N-QUICKSTART.md` (5 minutes)
2. **Regardez** `INTEGRATION-EXAMPLE.html` (exemples de code)
3. **Intégrez** dans votre page (copiez-collez)

## 📖 Pour en savoir plus

- **Guide complet** : `src/locales/README.md`
- **Crowdin docs** : https://support.crowdin.com/
- **ISO language codes** : https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes

## 🆘 Support

**Problème courant #1** : "i18n is not defined"
- ✅ Solution : Vérifiez que `i18n-client.js` est chargé AVANT vos autres scripts

**Problème courant #2** : "Traduction non trouvée"
- ✅ Solution : Vérifiez que la clé existe dans `en.json`
- ✅ Regardez la console : elle affiche les clés manquantes

**Problème courant #3** : "La langue ne change pas"
- ✅ Solution : Appelez `i18n.updateDOM()` après le changement de langue
- ✅ Vérifiez que les éléments ont bien l'attribut `data-i18n`

## 🎨 Personnalisation

### Ajouter un flag personnalisé

Dans `language-selector.js` :

```javascript
this.languages = {
    'en': { name: 'English', flag: '🇬🇧' },
    'fr': { name: 'Français', flag: '🇫🇷' },
    'custom': { name: 'Custom', flag: '🏴‍☠️' } // Ajoutez ici
};
```

### Modifier les styles

Éditez `src/renderer/css/i18n.css` pour personnaliser l'apparence du sélecteur.

### Utiliser votre propre système

Vous n'êtes pas obligé d'utiliser le sélecteur fourni ! Vous pouvez :

```javascript
// Créer votre propre UI
const myButton = document.createElement('button');
myButton.onclick = () => i18n.changeLocale('fr');
```

---

**Fait avec ❤️ pour FightPlanner**
