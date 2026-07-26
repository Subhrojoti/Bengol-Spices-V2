## Project Structure & Setup

This project follows a modular and scalable architecture with config-driven routing and centralized state management using Redux.

### Folder Structure Overview

src/
├── config/
│ ├── marketingRoutes.js
│ ├── orderManagementRoutes.js
│ └── routeConfig.js
│
├── components/
│ ├── Header.jsx
│ ├── Footer.jsx
│ └── (common reusable components)
│
├── routes/
│ ├── AppRouter.jsx
│ └── routerConfig.jsx
│
├── theme/
│ └── theme.js
│
├── redux/
│ ├── store.js
│ └── slices/
│ └── (feature-based slices)
│
├── pages/
│ ├── Home/
│ │ └── Home.jsx
│ └── marketingHub/
│ ├── MarketingHub.jsx
│ └── Tabs/
│ ├── Overview.jsx
│ ├── StoreCreation.jsx
│ ├── OrderCreation.jsx
│ ├── Payments.jsx
│ └── Returns.jsx

### Routing

- Each module has its own route configuration under `src/config`
- Example: `marketingRoutes.js`
- All module routes are mapped in `routeConfig.js`
- Header navigation consumes these config files as a single source of truth

### Global State Management (Redux)

- All global state is managed using Redux
- Feature-specific slices must be created under:

src/redux/slices

- Every new slice must be registered in `store.js`

### Pages & Modules

- `Home/Home.jsx` acts as the root layout
- Each module (e.g. MarketingHub) contains:
- A module layout file (e.g. `MarketingHub.jsx`)
- Feature pages under the `Tabs/` folder

### API Handling

- API should be defined under `api/services.js`

### Development Guidelines

- Do not hardcode routes or tab labels inside components
- Always add new routes via config files under `src/config`
- Any feature requiring global state must use Redux slices
- Common UI components should be placed under `src/components`
- Keep module-specific logic isolated within its module folder

---

### Bugs to be fixed

- Store creation OTP issue with duplicate cust id still exists

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
