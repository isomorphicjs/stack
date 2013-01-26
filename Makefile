
build: components lib/cache.js lib/index.js lib/proto.js lib/util.js
	@component build --dev

components: component.json
	@component install --dev

clean:
	rm -fr build components

.PHONY: clean
