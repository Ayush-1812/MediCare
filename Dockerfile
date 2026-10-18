# syntax=docker/dockerfile:1

# ---- deps: install full dependency tree (build tooling included) ----
FROM node:20-alpine AS deps
# openssl is required by Prisma's query engine on Alpine (musl) at generate-time;
# libc6-compat covers native modules that expect glibc shims.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder: compile the Next.js app ----
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- prod-deps: production-only dependencies (drops tailwind/eslint/typescript, etc.) ----
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# ---- runner: final runtime image ----
FROM node:20-alpine AS runner
# openssl is also required at *runtime* by the Prisma query engine, not just at generate-time.
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
# The custom Node server that hosts Next + the Socket.IO signaling channel.
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
# server.js `require`s these at boot — the shared cookie/JWT helpers and the voice
# receptionist gateway. Without them the container exits immediately with
# MODULE_NOT_FOUND and the whole app is down, not just the voice feature, so this COPY
# is not optional. `.dockerignore` keeps `server/.env` out of the image.
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
# `sed` strips carriage returns before chmod. Docker copies the *working tree*, and a
# Windows checkout with `core.autocrlf=true` — Git for Windows' default — rewrites this
# script to CRLF. The kernel then reads the shebang as `/bin/sh\r`, which does not exist,
# and the container dies at startup with:
#
#     exec ./docker-entrypoint.sh: no such file or directory
#
# That reads as a missing file, not a line-ending problem, and sends you hunting in the
# wrong place entirely. `.gitattributes` now pins `*.sh` to LF, but that only takes effect
# on a fresh checkout or after `git add --renormalize`, so existing clones would still
# produce a broken image. Normalising here makes the build correct from any checkout on
# any platform, which is where the guarantee belongs.
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Probes $PORT, not a hard-coded 3000. `server.js` listens on `process.env.PORT`, and
# container hosts (Render, Railway, Fly, Cloud Run) inject their own — so a fixed 3000
# here would probe a port nothing is listening on, mark a perfectly healthy container
# unhealthy, and put it in a restart loop that looks like the app crashing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
