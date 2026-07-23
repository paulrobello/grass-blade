.PHONY: dev preview build test lint fmt fmt-check typecheck accessibility-check mobile-check playthrough-check playthrough-check-headed contract-balance-capture timed-balance-capture perf-capture perf-capture-headed checkall pre-commit pre-commit-update

dev:
	bun run dev

preview:
	bun run preview

build:
	bun run build

test:
	bun run test

lint:
	bun run lint

fmt:
	bun run fmt

fmt-check:
	bun run fmt:check

typecheck:
	bun run typecheck

accessibility-check:
	bun run accessibility:check

mobile-check:
	bun run mobile:check

playthrough-check:
	bun run playthrough:check

playthrough-check-headed:
	bun run playthrough:check:headed

contract-balance-capture:
	bun run balance:contracts

timed-balance-capture:
	bun run balance:timed

perf-capture:
	bun run perf:capture

perf-capture-headed:
	bun run perf:capture:headed

checkall:
	bun run fmt:check
	bun run lint
	bun run typecheck
	bun run test
	bun run build

pre-commit:
	pre-commit run --all-files

pre-commit-update:
	pre-commit autoupdate
