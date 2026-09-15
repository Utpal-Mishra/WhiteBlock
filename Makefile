PYTHON ?= python

.PHONY: install db-up db-down db-reset ingest load reconcile ingest-guidance test

install:
	$(PYTHON) -m pip install -r requirements.txt

db-up:
	docker compose up -d postgis

db-down:
	docker compose down

db-reset:
	docker compose down -v
	docker compose up -d postgis

ingest:
	$(PYTHON) scripts/ingest_cork_parking.py

load:
	$(PYTHON) scripts/load_cork_to_postgis.py

reconcile:
	$(PYTHON) scripts/reconcile_source_records.py

ingest-guidance:
	$(PYTHON) scripts/ingest_dublin_vms.py

test:
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py'
