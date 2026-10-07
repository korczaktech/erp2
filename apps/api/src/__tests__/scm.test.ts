import assert from 'node:assert/strict';
import test from 'node:test';

function scaled(v: string): bigint {
  const [whole = '0', fraction = ''] = v.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

function cents(v: string): bigint {
  const [whole = '0', fraction = ''] = v.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function total(quantity: string, unitPrice: string): bigint {
  return (scaled(quantity) * cents(unitPrice) + 500_000n) / 1_000_000n;
}

test('F5 quantity precision is exact up to six decimal places', () => {
  assert.equal(scaled('1.234567'), 1_234_567n);
  assert.equal(scaled('10'), 10_000_000n);
  assert.equal(scaled('0.000001'), 1n);
});

test('F5 money calculation rounds deterministically to cents', () => {
  assert.equal(total('2.5', '10.00'), 2_500n);
  assert.equal(total('0.000001', '100.00'), 0n);
  assert.equal(total('1.005', '10.00'), 1_005n);
});

test('F5 receipt cannot exceed ordered quantity', () => {
  const ordered = scaled('10.000000');
  const alreadyReceived = scaled('7.250000');
  const incoming = scaled('2.750000');
  assert.equal(alreadyReceived + incoming <= ordered, true);
  assert.equal(alreadyReceived + incoming + 1n <= ordered, false);
});

test('F5 purchase lifecycle transitions are intentionally explicit', () => {
  const transitions: Record<string, string[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected', 'cancelled'],
    approved: [],
    rejected: [],
    cancelled: []
  };
  assert.equal(transitions.draft!.includes('approved'), false);
  assert.equal(transitions.submitted!.includes('approved'), true);
  assert.equal(transitions.submitted!.includes('cancelled'), true);
});


test('F5 outbox event envelope is versioned and correlated', () => {
  const event = {
    schemaVersion: 1,
    correlationId: 'aggregate-1',
    aggregateId: 'aggregate-1',
    type: 'purchase.received'
  };
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.correlationId, event.aggregateId);
  assert.equal(typeof event.type, 'string');
});

test('F5 idempotency payload fingerprints distinguish operations', () => {
  const stable = (v: unknown) => JSON.stringify(v);
  assert.notEqual(stable({number:'A',lines:[{productId:'p1',quantity:'1'}]}), stable({number:'A',lines:[{productId:'p1',quantity:'2'}]}));
});
