# Architecture decision record

Decision: treat pad-core as a reusable theory platform with browser-native modules and mechanically enforced native parity.

Reason: the ecosystem already has multiple consumers and the previous shared-script shape allowed theory to be copied when a consumer needed a capability that was not directly exposed.

Consequence: future shared musical semantics are extracted into pad-core before app-local implementation; native products consume generated data/parity fixtures; static-site embeds build on small headless ESM modules.
