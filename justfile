install:
  pnpm install

build:
  pnpm run build

test:
  pnpm run test

# sequential test
seqtest:
  pnpm test:integration:sequential

lint:
  pnpm run lint

clean:
  find . -name "node_modules" -type d -exec rm -rf '{}' +

# Run a single test by name
test-one TEST_NAME:
  pnpm test:integration:sequential --grep "{{TEST_NAME}}"
