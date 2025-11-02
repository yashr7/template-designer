# Dynamic Template Editor

A React-based web application for creating and managing dynamic HTML templates with AI-powered field generation.

## Features

- 📤 Upload HTML templates with placeholder syntax (`/*FieldName*/`)
- 🔗 Interactive clickable placeholders
- 📝 Define rules for each field:
  - JavaScript logic
  - AI prompts
  - Static values
- 🧪 Test rules in real-time
- 👁️ Live preview of generated documents
- 💾 Export generated JavaScript code

## Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/dynamic-template-editor.git

# Navigate to project directory
cd dynamic-template-editor

# Install dependencies
npm install

# Run development server
npm run dev
```

## Usage

1. Upload an HTML template file with placeholders (e.g., `/*CompanyName*/`)
2. Click on any placeholder to open the rule editor
3. Define how each field should be generated
4. Test your rules and preview the output
5. Export the generated code

## Tech Stack

- React 19
- Vite
- Tailwind CSS 3
- Lucide React (icons)

## License

MIT