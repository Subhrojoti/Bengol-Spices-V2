const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { component } = require('./helpers/component.cjs');

function load(file, imports) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    throw Error('Unexpected import: ' + name);
  }});
  return module.exports;
}

test('leaderboard API forwards selected metric and refuses to relabel legacy incentive results as sales', async () => {
  const calls = [], signal = new AbortController().signal;
  let response = { data: [{ agentId: 'A', earnedAmount: 50, sales: 900 }] };
  const { agentApi } = load('../src/api/agent.api.ts', {
    './client': { api: { get: async (url, config) => { calls.push({ url, config }); return { data: response }; } } },
    './unwrap': { unwrapList: body => body.data },
    '@/utils/dashboardData': { dashboardData: value => value },
  });
  const legacy = await agentApi.getLeaderboard();
  assert.equal(legacy.data[0].earnedAmount, 50);
  assert.equal(legacy.totalAgents, undefined);
  await assert.rejects(agentApi.getLeaderboard(undefined, undefined, 10, signal, 'SALES'), /latest server update/);
  response = { ...response, metric: 'SALES', totalAgents: 25, myStanding: { agentId: 'B', rank: 22 } };
  const sales = await agentApi.getLeaderboard(undefined, undefined, 10, signal, 'SALES');
  assert.equal(sales.myStanding.rank, 22);
  assert.equal(sales.totalAgents, 25);
  assert.equal(calls.at(-1).config.signal, signal);
  assert.equal(calls.at(-1).config.params.metric, 'SALES');
});

test('metric queries use separate cache entries and forward cancellation without background requests', async () => {
  let focused = true;
  const calls = [], signal = new AbortController().signal;
  const hooks = load('../src/hooks/useAgent.ts', {
    'expo-router': { useIsFocused: () => focused },
    '@tanstack/react-query': { useQuery: options => options },
    '@/api/agent.api': { agentApi: { getLeaderboard: async (...args) => { calls.push(args); return { metric: args[4], data: [] }; } } },
  });
  const incentive = hooks.useLeaderboard(), sales = hooks.useLeaderboard('SALES');
  assert.notEqual(JSON.stringify(incentive.queryKey), JSON.stringify(sales.queryKey));
  assert.equal((await sales.queryFn({ signal })).metric, 'SALES');
  assert.equal(calls[0][3], signal);
  assert.equal((await incentive.queryFn({ signal })).metric, 'INCENTIVE');
  focused = false;
  assert.equal(hooks.useLeaderboard('SALES').enabled, false);
});

test('switching ranking updates podium, rows and personal standing, including an agent below top ten', () => {
  const row = (id, rank, earnedAmount, sales) => ({ agentId: id, rank, name: id, earnedAmount, sales, state: 'WB', ordersDelivered: 2, completedTargets: 1 });
  const entries = Array.from({ length: 10 }, (_, i) => row('A' + i, i + 1, 100 - i, 1000 - i * 10));
  const reports = {
    INCENTIVE: { data: entries, totalAgents: 25, myStanding: row('ME', 22, 7, 4000), nextAbove: row('OTHER', 21, 9, 30) },
    SALES: { data: [row('ME', 1, 7, 4000), ...entries.slice(0, 9)], totalAgents: 25, myStanding: row('ME', 1, 7, 4000), nextAbove: null },
  };
  let loading = false, error = false;
  const h = component('../app/leaderboard.tsx', {
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', FlatList: 'FlatList', StyleSheet: { create: value => value } },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@/utils/image': { sizedImage: url => url },
    '@/components/ui/ProfileAvatar': { initialsOf: name => name[0] },
    '@/theme/colors': { colors: new Proxy({}, { get: () => ({}) }), gradients: { saffronWash: [] } },
    '@/hooks/useAgent': { useProfile: () => ({ data: { agentId: 'ME' } }), useLeaderboard: metric => ({ data: loading ? undefined : reports[metric], isLoading: loading, isError: error, error: new Error('Offline'), refetch() {} }) },
    '@/hooks/usePullToRefresh': { usePullToRefresh: () => ({ pulling: false, onPull() {} }) },
  });
  const find = name => h.nodes().find(n => typeof n.type === 'function' ? n.type.name === name : n.type === name);
  const content = node => {
    if (!node || typeof node !== 'object') return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
    if (typeof node.type === 'function') return content(node.type(node.props));
    return [node.props?.children].flat(Infinity).map(content).join(' ').replace(/\s+/g, ' ');
  };
  h.render();
  assert.match(content(find('StandingCard')), /22nd of 25/);
  assert.match(content(find('StandingCard')), /7 earned/);
  assert.match(content(find('StandingCard')), /to reach # 21/);
  assert.match(content(find('Podium')), /100/);
  find('SegmentedControl').props.onChange('SALES'); h.render();
  assert.match(content(find('StandingCard')), /1st of 25/);
  assert.match(content(find('StandingCard')), /4000 sales/);
  assert.match(content(find('Podium')), /4000/);
  const list = find('FlatList');
  const rankedRow = list.props.renderItem({ item: list.props.data[0], index: 0 });
  assert.match(content(rankedRow), /980/);
  assert.equal(rankedRow.props.metric, 'SALES');
  loading = true; h.render();
  assert(find('LoadingState')); assert.equal(find('FlatList'), undefined);
  assert(find('SegmentedControl'));
  loading = false; error = true; h.render();
  assert(find('ErrorState')); assert.equal(find('FlatList'), undefined);
});
