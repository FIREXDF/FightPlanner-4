# FightPlanner i18n (Internationalization)

Système de traduction simple et compatible avec Crowdin pour FightPlanner.

## 📁 Structure

```
src/
├── locales/
│   ├── en.json           # Anglais (langue source)
│   ├── fr.json           # Français
│   ├── i18n.js           # Module Node.js pour le main process
│   └── README.md         # Cette documentation
├── renderer/
│   └── js/
│       └── i18n/
│           └── i18n-client.js  # Client pour le renderer process
```

## 🚀 Utilisation dans le HTML

### 1. Inclure le script i18n

Dans votre fichier HTML (par exemple `index.html`), ajoutez :

```html
<script src="js/i18n/i18n-client.js"></script>
```

### 2. Initialiser i18n

Dans votre script principal :

```javascript
// Initialiser avec la langue sauvegardée ou par défaut 'en'
document.addEventListener('DOMContentLoaded', async () => {
    const savedLocale = i18n.getSavedLocale();
    await i18n.init(savedLocale);
});
```

### 3. Utiliser les attributs data-i18n

#### Texte simple

```html
<span data-i18n="sidebar.tools">Mods</span>
<button data-i18n="common.save">Save</button>
```

#### Placeholder d'input

```html
<input type="text" data-i18n="tabs.tools.search" data-i18n-placeholder>
```

#### Titre/tooltip

```html
<button data-i18n="titlebar.minimize" data-i18n-title>
    <i class="icon-minimize"></i>
</button>
```

#### Avec interpolation de variables

```html
<span 
    data-i18n="messages.welcome" 
    data-i18n-param-name="John">
</span>
```

Dans le JSON :
```json
{
    "messages": {
        "welcome": "Welcome {{name}}!"
    }
}
```

### 4. Utiliser en JavaScript

```javascript
// Obtenir une traduction
const text = i18n.t('common.save');

// Avec des paramètres
const message = i18n.t('messages.welcome', { name: 'John' });

// Changer de langue
await i18n.changeLocale('fr');

// Écouter les changements de langue
window.addEventListener('localeChanged', (event) => {
    console.log('New locale:', event.detail.locale);
    // Rafraîchir votre UI si nécessaire
});

// Obtenir la langue actuelle
const currentLang = i18n.getCurrentLocale(); // 'en', 'fr', etc.

// Obtenir les langues disponibles
const languages = i18n.getAvailableLocales(); // ['en', 'fr']
```

## 📝 Structure des fichiers JSON

Les traductions sont organisées de manière hiérarchique :

```json
{
  "app": {
    "title": "FightPlanner"
  },
  "sidebar": {
    "tools": "Mods",
    "plugins": "Plugins"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

Accès : `i18n.t('sidebar.tools')` → "Mods"

## 🌍 Crowdin Integration

### Installation

```bash
npm install -g @crowdin/cli
```

### Configuration

1. Créez un compte sur [Crowdin](https://crowdin.com/)
2. Créez un nouveau projet
3. Modifiez `crowdin.yml` à la racine du projet avec votre `project_id`
4. Obtenez votre token API depuis [Crowdin Settings](https://crowdin.com/settings#api-key)

### Commandes principales

```bash
# Uploader le fichier source (en.json) vers Crowdin
crowdin upload sources

# Télécharger les traductions depuis Crowdin
crowdin download

# Uploader les traductions existantes
crowdin upload translations

# Vérifier le statut
crowdin status
```

### Workflow de traduction

1. **Modifier la source** : Éditez `src/locales/en.json`
2. **Upload** : `crowdin upload sources`
3. **Traduire** : Allez sur Crowdin pour traduire ou inviter des traducteurs
4. **Download** : `crowdin download` pour récupérer les traductions
5. **Commit** : Ajoutez les nouveaux fichiers JSON au git

## ➕ Ajouter une nouvelle langue

### 1. Dans Crowdin
- Ajoutez la langue dans les paramètres de votre projet Crowdin

### 2. Localement

Créez le fichier de traduction :
```bash
cp src/locales/en.json src/locales/es.json
```

### 3. Dans le code

Ajoutez la langue dans `i18n-client.js` :

```javascript
this.availableLocales = ['en', 'fr', 'es']; // Ajoutez 'es'
```

### 4. Synchronisez

```bash
crowdin download
```

## 🎨 Exemple de sélecteur de langue

```html
<!-- Dans votre HTML -->
<select id="language-selector">
    <option value="en">English</option>
    <option value="fr">Français</option>
</select>

<script>
const selector = document.getElementById('language-selector');
selector.value = i18n.getCurrentLocale();

selector.addEventListener('change', async (e) => {
    await i18n.changeLocale(e.target.value);
});
</script>
```

## ⚠️ Best Practices

1. **Toujours utiliser `en.json` comme source** - C'est la langue de référence
2. **Utiliser des clés descriptives** - `tabs.tools.search` plutôt que `t1`
3. **Grouper par contexte** - Organisez vos clés logiquement
4. **Ne jamais éditer directement les traductions autres que `en.json`** - Utilisez Crowdin
5. **Tester avec plusieurs langues** - Assurez-vous que votre UI s'adapte aux textes longs

## 🔍 Débogage

```javascript
// Vérifier si une clé existe
console.log(i18n.t('some.key')); // Affiche 'some.key' si non trouvée

// Voir toutes les traductions chargées
console.log(i18n.translations);

// Langue actuelle
console.log(i18n.getCurrentLocale());
```

## 📦 Codes de langue supportés

- `en` - English
- `fr` - Français
- `es` - Español
- `de` - Deutsch
- `it` - Italiano
- `pt` - Português
- `ja` - 日本語
- `ko` - 한국어
- `zh-CN` - 简体中文
- `zh-TW` - 繁體中文

[Liste complète des codes](https://support.crowdin.com/api/language-codes/)
