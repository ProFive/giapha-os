.PHONY: help install check build preview deploy

help:
	@echo "make install  - cài dependencies (bun)"
	@echo "make check    - lint + typecheck"
	@echo "make build    - build production local"
	@echo "make preview  - check + build, rồi deploy Vercel preview"
	@echo "make deploy   - check + build, rồi deploy Vercel production"
	@echo ""
	@echo "Nhớ chạy migration mới (docs/migrations) lên Supabase trước khi deploy production."

install:
	bun install

check:
	bun run lint
	bunx tsc --noEmit -p .

build:
	rm -rf .next
	bun run build

preview: check build
	vercel deploy

deploy: check build
	vercel deploy --prod
