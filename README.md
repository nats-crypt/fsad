# Horizon Airways

A monorepo for the Horizon Airways airline reservation system built with React, Express, Prisma, and PostgreSQL.

## Workspace Structure

- **apps/web** - React frontend application
- **apps/api** - Express backend API
- **packages/db** - Prisma database layer

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run development servers:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development servers for API and web concurrently
- `npm run dev:api` - Start only the API development server
- `npm run dev:web` - Start only the web development server
- `npm run build` - Build the application for production
- `npm run test` - Run test suite
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database

## Node Version

This project requires Node.js 20 or higher. The `.nvmrc` file specifies the target version (22).
