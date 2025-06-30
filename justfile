install:
  yarn

build:
  yarn run build

test:
  yarn run test

# sequential test
seqtest:
  yarn test:integration:sequential

lint:
  yarn run lint

clean:
  find . -name "node_modules" -type d -exec rm -rf '{}' +

# Run a single test by name
test-one TEST_NAME:
  yarn test:integration:sequential --grep "{{TEST_NAME}}"
