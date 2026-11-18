import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardData } from '../src/utils/dashboardData.ts';
import { unwrapObject, unwrapList } from '../src/api/unwrap.ts';

const good = () => ({ summary: { totalStoresCreated: 0, totalCollected: 0, totalIncentive: 0,
  targetAchievedCount: 0, totalSalesAmount: 0, totalDue: 0, totalOrdersDelivered: 0,
  totalCancelled: 0, totalReturns: 0 }, monthly: [{ month: 'Nov', sales: 0 }] });

test('invalid overview data is a query error before a chart can crash or display invented zeros', () => {
  for (const value of [null, {}, { summary: good().summary }, { ...good(), monthly: [null] },
    { ...good(), monthly: [{ month: 'Nov', sales: NaN }] }, { ...good(), summary: { ...good().summary, totalDue: Infinity } }]) {
    assert.throws(() => dashboardData(value), /overview response is incomplete/);
  }
  const valid = good(); assert.equal(dashboardData(valid), valid);
  valid.summary.totalCollected = 12.34; assert.equal(dashboardData(valid).summary.totalCollected, 12.34);
});

test('object responses reject primitive and array payloads safely and retain supported wrappers', () => {
  for (const value of [null, undefined, '', 'offline', 42, true, [], { data: [] }, { data: null }]) assert.equal(unwrapObject(value), null);
  const record = { name: 'Agent' }; assert.equal(unwrapObject(record), record); assert.equal(unwrapObject({ data: record }), record);
});

test('null or primitive entity rows become retryable query errors without silently dropping records', () => {
  for (const list of [[null], [42], ['bad'], [[]], [{_id:'valid'},null]]) {
    for (const body of [list,{data:list},{data:{orders:list}},{unexpected:list}]) assert.throws(()=>unwrapList(body),/incomplete list data/);
  }
  const list=[{_id:'A'},{_id:'B'}]; assert.equal(unwrapList({orders:list}),list);assert.deepEqual(unwrapList({orders:[]}),[]);
});
