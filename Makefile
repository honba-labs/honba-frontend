# Dev helpers. `just` isn't installed here, so this is a Makefile.
# Override on the command line: make dev DATA_DIR=/path/to/parquet/bars
DATA_DIR ?= ../honba-data/data
JOURNALS_DIR ?= ../honba-data/data/journals
API_ADDR ?= 127.0.0.1:8000   # must match the proxy in vite.config.ts

.PHONY: api web dev

# Backend only (honba serve)
api:
	cd ../honba && cargo run -p honba-cli -- serve \
		--data-dir $(abspath $(DATA_DIR)) \
		--journals-dir $(abspath $(JOURNALS_DIR)) \
		--addr $(API_ADDR) --cors-origin http://localhost:5174

# Frontend only (vite)
web:
	npm run dev

# Both together; Ctrl-C stops both
dev:
	$(MAKE) -j2 api web
