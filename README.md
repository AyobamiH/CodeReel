# Animated Code

> A web-based editor for creating and exporting animated code sequences.

**animated-code** is a browser app for turning source code into animations. Compose a sequence of code frames, choose how they transition, preview the result, and export it to share in tutorials, documentation, and social posts.

The project is in early development. The sections below describe where it's headed and how to get involved.

## Features

Planned and in progress:

- Compose animations from code snippets with syntax highlighting
- Frame-by-frame transitions and timing controls
- Live preview in the browser
- Export to video or animated image formats
- Save and share projects, with accounts backed by Supabase
- Optional paid tiers via PayPal

## Tech stack

- **[Next.js](https://nextjs.org/)** and **[React](https://react.dev/)** for the application framework and UI
- **[Supabase](https://supabase.com/)** for the database, authentication, and storage
- **[PayPal](https://developer.paypal.com/)** for payments

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm (bundled with Node.js)
- A [Supabase](https://supabase.com/) project
- A [PayPal developer](https://developer.paypal.com/) account, for payment features

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/animated-code.git
   cd animated-code
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root with the following variables:

   ```bash
   # Supabase — Project Settings → API in your Supabase dashboard
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # PayPal — https://developer.paypal.com/dashboard/applications
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Contributing

Contributions are welcome, whether it's your first open source contribution or your thousandth. Read the [contributing guide](CONTRIBUTING.md) to get started.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By taking part, you agree to uphold it.

## License

Released under the [MIT License](LICENSE).
