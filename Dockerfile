# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy application source code and tsconfig
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

# Compile TypeScript code to dist/
RUN npm run build

# Prune devDependencies to keep image size small
RUN npm prune --omit=dev


# Stage 2: Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Install curl or wget for healthcheck if needed (alpine already includes wget)
# Create app directory with permissions for non-root user
USER node

# Copy production dependencies and built artifacts from builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/dist ./dist

# Expose default HTTP port
EXPOSE 4000

# Health check to ensure API is ready and serving requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start production server
CMD ["node", "dist/main.js"]
