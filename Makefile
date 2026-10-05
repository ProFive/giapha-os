DB         ?= giapha-os
WRANGLER   := npx wrangler
OPENNEXT   := npx opennextjs-cloudflare

.PHONY: help install login build preview deploy deploy-preview \
	db-migrate db-migrate-local db-seed db-seed-local db-list release

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

install: ## Install dependencies
	bun install

login: ## Authenticate wrangler with Cloudflare
	$(WRANGLER) login

build: ## Build Next.js app for Cloudflare Workers (OpenNext)
	$(OPENNEXT) build

preview: build ## Run the Worker build locally
	$(OPENNEXT) preview

deploy: build ## Deploy to production
	$(OPENNEXT) deploy

deploy-preview: build ## Upload a new version with a preview URL (no traffic shift)
	$(OPENNEXT) upload

db-migrate: ## Apply D1 migrations (remote)
	$(WRANGLER) d1 migrations apply $(DB) --remote

db-migrate-local: ## Apply D1 migrations (local)
	$(WRANGLER) d1 migrations apply $(DB) --local

db-seed: ## Seed remote D1
	$(WRANGLER) d1 execute $(DB) --remote --file=migrations/0002_seed.sql

db-seed-local: ## Seed local D1
	$(WRANGLER) d1 execute $(DB) --local --file=migrations/0002_seed.sql

db-list: ## List D1 migrations status (remote)
	$(WRANGLER) d1 migrations list $(DB) --remote

release: db-migrate deploy ## Migrate remote DB, then deploy to production
