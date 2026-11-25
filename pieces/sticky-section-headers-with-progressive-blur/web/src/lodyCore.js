// Lody 对话列表 · 吸顶分组标题 + 顶部渐进模糊 —— HTML 预览与 RN 组件共用的 core
// 坐标单位 pt，屏幕 402×874（iPhone 16/17 Pro）。所有数值来自 source.mp4 的逐帧测量（见 ANALYSIS.md）。
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.LodyCore = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var W = 402, H = 874;

  // ---------- 布局常量 ----------
  var L = {
    W: W, H: H,
    padX: 19.4,                      // 内容左右边距
    stickyTop: 116.1,               // 分组标题吸顶位置（标题行顶）
    labelH: 30,                     // 分组标题行高（两枚标题顶走时的间距）
    labelGapTop: 12.2,              // 上一行底 → 标题行顶
    labelGapBottom: 0.35,           // 标题行底 → 下一行顶
    firstLabelTop: 116.1,
    top2: { h: 58.8, tc: 19.15, sc: 41.05 },     // 一级两行：行高 / 标题中心 / 副标题中心
    top1: { h: 44.3, tc: 22.15 },                // 一级单行
    top1Parent: { h: 44.3, tc: 21.65 },          // 一级单行（带子对话）
    child2: { h: 56.55, tc: 19.6, sc: 39.9 },     // 子对话两行
    child1: { h: 41.4, tc: 20.65 },              // 子对话单行
    chdrH: 43.5,                                 // “N 个子对话”行高（文字居中）
    groupGapBottom: 0.65,                        // 子对话组底 → 下一个一级行
    childX: 51.5,                                 // 子对话文字左缘
    treeX: 25.5, treeR: 11, treeEndX: 43.7,      // 树线：竖干 x / 拐角半径 / 横线终点
    subIconD: 14.3, subTextDX: 20.6,             // 副标题图标直径、文字相对图标左缘的偏移
    timeRight: 354.3, slotCx: 344.7,               // 时间右缘；状态槽（蓝点 / 点阵）中心
    avatarCx: 373.4, avatarD: 19.2,
    statusCx: 373.85,                             // 第二行右侧状态图标（合并 / PR）中心
    titleGap: 9, boldWeight: '500', slotTitleRight: 321.2,
    bottomPad: 110,
    // 顶栏胶囊
    pillTop: 62, pillH: 44, pillL: { x: 15, w: 120 }, pillR: { x: 281, w: 106 },
    // Tab 栏
    tab: { x: 20, y: 792.5, w: 292, h: 62, selW: 100, selH: 54, centers: [74.7, 166, 257.3], iconCy: 816.6, textCy: 838, composeCx: 351, composeD: 62 },
    // 滚动条
    ind: { x: 396.2, w: 3, trackTop: 115, trackBottom: 779 },
    // 文字盒：字号 / 行高 / 墨迹中心相对行盒中心的修正（由预览截图与原片同脚本测量标定）
    font: {
      title: { size: 16, lh: 22, dy: -0.45 }, childTitle: { size: 15, lh: 20, dy: -1.3 }, sub: { size: 13, lh: 18, dy: -0.8 },
      time: { size: 13, lh: 16, dy: -0.5 }, label: { size: 16, lh: 22, dy: -0.8 }, chdr: { size: 13, lh: 18, dy: -0.7 }
    }
  };
  var C = { title: '#191919', sub: '#626262', time: '#888888', label: '#868686', chev: '#888888', tree: '#D2D2D2', merge: '#7A4FD6', blue: '#628BEB', green: '#2E9E62', brown: '#A0521C', tabSel: '#3F56B5' };

  // ---------- 顶部模糊 / 泛白曲线（m14_mix：静止帧上按“清晰层 + 模糊层按遮罩混合”拟合，rmse 1–3/255） ----------
  // 一层 backdrop blur（σ = 7.2pt），遮罩不透明度 m(y) 即模糊份额；其上再盖白色 alpha(y)。168pt 以下完全清晰。
  var BLUR = { sigma: 7.2, bottom: 168, mask: [[0, 1], [46, 1], [52, 0.98], [88, 0.92], [110, 0.89], [123, 0.86], [130, 0.85], [145, 0.84], [149, 0.76], [151, 0.68], [153, 0.60], [155, 0.53], [157, 0.44], [159, 0.35], [161, 0.25], [164.5, 0.15], [167.5, 0]] };
  var FADE = [[0, 0.5], [30, 0.45], [46, 0.39], [55, 0.28], [88, 0.27], [106, 0.20], [110, 0.15], [122, 0.12], [130, 0.06], [138, 0]];
  var FADE_BOTTOM = 138;

  // ---------- 数据 ----------
  function K(t, sub, o) { var r = { t: t, sub: sub || null }; if (o) for (var k in o) r[k] = o[k]; return r; }
  var SECTIONS = [
    { label: '已置顶', rows: [
      K('安全问题扫描', null, { time: '5小时', kids: [K('推进 Electron 44.10.0 安全修复与 Lody桌面端发布', 'lody', { time: '5天' })] }),
      K('Build Lody Electron', 'lody', { time: '1天', st: 'merge' }),
      K('查找生成优惠码脚本', 'lody', { time: '4天', st: 'merge' }),
      K('发布 Lody', 'lody', { time: '10月19日', st: 'merge' }),
      K('Effect 教学', null, { time: '10月17日' }),
      K('release rr', 'loro-streams', { time: '9月29日' }),
      K('✨ Loro 2.0设计评审', 'loro-dev/loro', { time: '4月26日' })
    ] },
    { label: '需要你处理', rows: [
      K('分析 daemon 远程更新重启不稳定问题', 'LodyAI/Lody', { sq: 1, time: '3天', st: 'prcheck' })
    ] },
    { label: '刚完成', rows: [
      K('lorodoc、flock、streams-crdt 本地服务端联调', 'LodyAI/Lody', { sq: 1, bold: 1, slot: 'dot', kids: [
        K('D16-A replica durable room/data review', 'loro-dev/loro-repo', { slot: 'grid' }),
        K('M3.4 Loro stable element ID spike', 'loro-dev/loro', { slot: 'grid' }),
        K('Unified uplink/downlink message chunking', 'loro-dev/loro-repo', { slot: 'grid' }),
        K('M2.1 Replicator interface design spec', 'loro-dev/loro-repo', { slot: 'grid' }),
        K('M4.1 Rust client spec-fix remaining five', 'loro-dev/loro-repo', { slot: 'grid' }),
        K('Design View Top-K Window Mode', 'loro-dev/loro-repo', { slot: 'grid' }),
        K('Fix import_batch_detailed empty-diff panic', 'loro-dev/loro', { time: '17小时' }),
        K('独立审核 PR 1258 的输入校验与导入安全性', 'loro-dev/loro', { time: '3天' })
      ] }),
      K('端到端加密工作区设置页', 'LodyAI/Lody', { sq: 1, bold: 1, slot: 'dot', st: 'prdot', kids: [
        K('复审四个 Web E2EE 客户端保管草稿 PR', null, { slot: 'grid' }),
        K('补充 Web 端 E2EE 客户端保管 Spec 与威胁模型', 'LodyAI/Lody', { sq: 1, time: '1小时', pre: 'prcheck' }),
        // —— 以下为原片未露出的内容（原片只拍到屏幕上半、滚到 1032pt），按同类条目自拟 ——
        K('密钥轮换与设备吊销流程走查', 'LodyAI/Lody', { sq: 1, time: '2小时' })
      ] }),
      K('修复 Windows 自动更新签名校验', 'lody', { time: '2天', st: 'merge' }),
      K('整理 Loro 1.9 发布说明', 'loro-dev/loro', { time: '2天' }),
      K('workspace 邀请链接过期策略', 'LodyAI/Lody', { sq: 1, time: '3天', st: 'prcheck', kids: [
        K('Invite token TTL and revoke API', 'LodyAI/Lody', { sq: 1, time: '3天' }),
        K('邀请页文案与多语言校对', null, { time: '3天' })
      ] }),
      K('Benchmark movable list merge', 'loro-dev/loro', { time: '4天', st: 'merge' }),
      K('调研 iOS 26 液态玻璃导航栏适配', null, { time: '5天' }),
      K('streams-crdt 压缩格式 v2 设计', 'loro-streams', { time: '6天', kids: [
        K('Columnar encoding for op headers', 'loro-streams', { time: '6天' }),
        K('Snapshot fast-forward 兼容性测试', 'loro-streams', { time: '6天' }),
        K('Fuzz 新旧格式互读', 'loro-streams', { time: '1周' })
      ] }),
      K('daemon 日志分级与本地落盘', 'LodyAI/Lody', { sq: 1, time: '1周', st: 'merge' }),
      K('重写会话列表的吸顶与模糊', 'lody', { time: '1周', st: 'merge' }),
      K('Review: tree move conflict cases', 'loro-dev/loro', { time: '10月28日' }),
      K('定时任务失败重试与通知', 'LodyAI/Lody', { sq: 1, time: '10月27日', st: 'prcheck' }),
      K('梳理 Lody CLI 子命令帮助文本', 'lody', { time: '10月25日' }),
      K('Loro inspector 时间旅行面板', 'loro-dev/loro-inspector', { time: '10月24日', st: 'merge' }),
      K('排查 flock 长连接偶发断流', 'loro-dev/flock', { time: '10月22日' }),
      K('设计评审：权限模型与分享范围', null, { time: '10月21日' }),
      K('升级 wasm-bindgen 与构建缓存', 'loro-dev/loro', { time: '10月20日', st: 'merge' }),
      K('对话导出为 Markdown 与附件打包', 'lody', { time: '10月20日' }),
      K('Pin 置顶上限与排序规则', 'LodyAI/Lody', { sq: 1, time: '10月19日', st: 'merge' })
    ] }
  ];

  // ---------- 布局：把数据展开成带绝对 y 的行 ----------
  function buildLayout() {
    var rows = [], labels = [], trees = [], y = L.firstLabelTop, id = 0;
    SECTIONS.forEach(function (sec, si) {
      if (si > 0) y += L.labelGapTop;
      labels.push({ i: si, text: sec.label, top: y });
      y += L.labelH + L.labelGapBottom;
      sec.rows.forEach(function (r) {
        var two = !!r.sub, m = two ? L.top2 : (r.kids ? L.top1Parent : L.top1);
        rows.push({ id: id++, kind: 'top', sec: si, top: y, h: m.h, tc: y + m.tc, sc: two ? y + m.sc : null, x: L.padX, d: r });
        y += m.h;
        if (r.kids) {
          rows.push({ id: id++, kind: 'chdr', sec: si, top: y, h: L.chdrH, tc: y + L.chdrH / 2, text: r.kids.length + ' 个子对话' });
          y += L.chdrH;
          var tree = { x: L.treeX, y0: y, elbows: [] };
          r.kids.forEach(function (k) {
            var two2 = !!k.sub, mk = two2 ? L.child2 : L.child1;
            rows.push({ id: id++, kind: 'child', sec: si, top: y, h: mk.h, tc: y + mk.tc, sc: two2 ? y + mk.sc : null, x: L.childX, d: k });
            tree.elbows.push(y + mk.tc - 1);
            y += mk.h;
          });
          trees.push(tree);
          y += L.groupGapBottom;
        }
      });
    });
    var contentH = y + L.bottomPad;
    return { rows: rows, labels: labels, trees: trees, contentH: contentH, maxScroll: contentH - H };
  }
  var LAYOUT = buildLayout();

  // ---------- 吸顶标题状态 ----------
  // 被下一枚标题顶走的旧标题：一离开吸顶位就从模糊层之上换到模糊层之下（1pt 内交叉淡化），
  // 于是和内容一样被模糊 / 泛白，同时自身随被顶距离淡出（原片 f139–144 逐帧对照）
  var PUSH_OPACITY = [[0, 1], [5, 0.9], [9.4, 0.75], [13.7, 0.5], [18.4, 0.3], [22.8, 0.1], [26, 0]];
  function lerpTable(tb, x) {
    if (x <= tb[0][0]) return tb[0][1];
    for (var i = 1; i < tb.length; i++) if (x <= tb[i][0]) { var a = tb[i - 1], b = tb[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return tb[tb.length - 1][1];
  }
  function labelStates(S) {
    var ls = LAYOUT.labels, out = [];
    for (var i = 0; i < ls.length; i++) {
      var nat = ls[i].top - S, top = Math.max(nat, L.stickyTop), push = 0;
      if (i + 1 < ls.length) { var lim = ls[i + 1].top - S - L.labelH; if (lim < top) { push = top - lim; top = lim; } }
      var r = Math.min(1, Math.max(0, push)), op = push <= 0 ? 1 : lerpTable(PUSH_OPACITY, push);
      // over = 模糊层之上那份的不透明度；under = 模糊层之下那份
      out.push({ i: i, text: ls[i].text, top: top, push: push, over: 1 - r, under: push < 1 ? r * lerpTable(PUSH_OPACITY, 1) : op, stuck: nat <= L.stickyTop && push === 0 });
    }
    return out;
  }

  // RN 原生驱动用：把 labelStates 写成滚动量 S 的分段线性插值表（与 labelStates 逐点一致，见 tools/rn_parity.mjs）
  function labelTracks() {
    var ls = LAYOUT.labels, FAR = 4000;
    return ls.map(function (l, i) {
      var Sa = l.top - L.stickyTop, last = i + 1 >= ls.length, Sb = last ? null : ls[i + 1].top - L.labelH - L.stickyTop;
      var o = { i: i, text: l.text };
      if (last) { o.topIn = [Sa - FAR, Sa, Sa + 1]; o.topOut = [L.stickyTop + FAR, L.stickyTop, L.stickyTop]; o.overIn = [0, 1]; o.overOut = [1, 1]; o.underIn = [0, 1]; o.underOut = [0, 0]; return o; }
      o.topIn = [Sa - FAR, Sa, Sb, Sb + FAR]; o.topOut = [L.stickyTop + FAR, L.stickyTop, L.stickyTop, L.stickyTop - FAR];
      if (Sb <= Sa) { o.topIn = [Sb - FAR, Sb, Sb + FAR]; o.topOut = [L.stickyTop + FAR, L.stickyTop, L.stickyTop - FAR]; }
      o.overIn = [Sb, Sb + 1]; o.overOut = [1, 0];
      o.underIn = [Sb, Sb + 1]; o.underOut = [0, lerpTable(PUSH_OPACITY, 1)];
      for (var k = 1; k < PUSH_OPACITY.length; k++) { o.underIn.push(Sb + PUSH_OPACITY[k][0]); o.underOut.push(PUSH_OPACITY[k][1]); }
      return o;
    });
  }

  // ---------- 滚动条 ----------
  function indicator(S) {
    var tk = L.ind.trackBottom - L.ind.trackTop, max = LAYOUT.maxScroll;
    var len = tk * tk / (tk + max), over = S < 0 ? -S : (S > max ? S - max : 0);
    var l2 = Math.max(8, len - over * 1.0), p = Math.min(1, Math.max(0, S / max));
    var top = L.ind.trackTop + p * (tk - len) + (S > max ? len - l2 : 0);
    return { x: L.ind.x, w: L.ind.w, top: top, h: l2 };
  }

  // ---------- 演示时间线：原片逐帧滚动表（m03_scroll，30fps，第 36 帧起；之前是不复刻的推镜） ----------
  var SCROLL_F0 = 36, FPS = 30, DUR = 323 / 30;
  var SCROLL = [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,21.7,26.1,31.1,35.5,39.8,44.2,48.5,52.5,55.9,59.2,62.6,66.6,71.0,76.6,83.0,89.0,95.1,101.1,108.1,115.5,122.8,130.2,137.5,144.2,150.6,156.9,162.6,167.3,172.3,177.3,182.0,186.4,190.7,195.1,200.4,206.1,212.1,218.2,224.8,232.2,240.2,247.6,254.6,262.0,268.7,275.4,282.0,288.1,293.8,299.4,305.1,310.5,315.8,321.5,327.5,334.6,342.6,351.6,361.0,371.4,381.4,391.4,399.1,403.5,406.5,410.2,414.2,419.2,424.6,429.6,434.6,440.3,446.0,451.0,455.7,459.0,460.7,461.0,461.0,461.0,461.0,461.0,464.0,467.4,470.7,473.7,476.1,478.4,480.8,482.8,485.4,488.1,490.8,494.1,497.1,500.5,504.8,509.2,513.9,518.2,521.9,525.3,528.3,531.3,534.6,537.0,539.6,541.6,543.7,544.7,546.3,548.3,550.3,552.0,555.0,558.4,561.7,565.1,567.7,570.7,573.8,576.1,578.8,581.8,584.5,588.5,591.8,595.5,598.5,602.2,606.2,610.2,613.9,617.6,621.2,624.3,627.3,629.3,632.6,636.0,639.0,642.0,644.3,647.3,650.3,653.0,656.0,659.4,663.4,667.4,670.4,673.8,676.8,680.8,684.8,689.5,693.8,697.8,701.2,704.5,707.5,710.9,714.6,719.3,723.3,727.9,732.3,737.0,742.3,747.7,753.0,757.4,764.1,770.1,776.8,783.1,788.8,794.5,800.2,805.5,810.6,815.6,821.6,828.3,835.0,842.0,849.4,855.7,861.4,866.4,872.1,878.5,884.5,890.2,896.5,902.9,910.3,917.3,925.3,933.7,942.0,949.7,957.4,964.8,971.5,978.2,985.2,991.5,997.6,1003.9,1010.3,1016.6,1021.7,1025.7,1028.7,1030.4,1030.7,1031.0,1031.3,1031.7,1032.0,1032.3,1032.3,1032.3,1032.3,1032.3,1032.3,1030.0,1024.3,1014.3,993.2,960.4,913.9,866.4,816.5,742.6,660.6,585.7,515.4,449.5,388.0,330.4,276.6,226.4,179.2,135.1,93.9,55.4,19.3,-12.5,-28.5,-33.5,-32.9,-29.5,-25.2,-20.5,-16.5,-13.1,-10.1,-7.8,-6.1,-4.4,-3.4,-2.7,-2.1,-1.4,-1.1,-0.7,-0.7,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0];
  function scrollAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    var f = t * FPS + 1 - SCROLL_F0;
    if (f <= 0) return 0;
    var i = Math.floor(f), n = SCROLL.length;
    if (i >= n - 1) return SCROLL[n - 1];
    return SCROLL[i] + (SCROLL[i + 1] - SCROLL[i]) * (f - i);
  }
  // 滚动条显隐：开始滚动即出现，停稳 0.9s 后 0.3s 淡出
  var MOVE_T0 = (43 - 1) / FPS, REST_T = (314 - 1) / FPS;
  function indicatorOpacityAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    if (t < MOVE_T0) return 0;
    if (t < MOVE_T0 + 0.12) return (t - MOVE_T0) / 0.12;
    if (t > REST_T + 0.9) return Math.max(0, 1 - (t - REST_T - 0.9) / 0.3);
    return 1;
  }
  function frame(t) { var S = scrollAt(t); return { t: t, scroll: S, labels: labelStates(S), ind: indicator(S), indOpacity: indicatorOpacityAt(t) }; }
  function frameAtScroll(S) { return { t: null, scroll: S, labels: labelStates(S), ind: indicator(S), indOpacity: 1 }; }

  // ---------- 图标：Lucide（ISC）路径，24 视口；两端用同一份数据渲染 ----------
  var ICONS = {
    search: [['c', 11, 11, 8], ['p', 'm21 21-4.3-4.3']],
    filter: [['p', 'M2.25 6.65h19.5'], ['p', 'M4.45 12h15.1'], ['p', 'M6.8 17.35h10.4']],
    chevron: [['p', 'm6 9 6 6 6-6']],
    merge: [['c', 18, 18, 3], ['c', 6, 6, 3], ['p', 'M6 21V9a9 9 0 0 0 9 9']],
    pr: [['c', 7, 6, 3], ['p', 'M7 9v12'], ['p', 'M18 4.5v.5'], ['p', 'M18 9.5v.5']],
    check: [['p', 'M13 17.5l3.2 3.2 6.3-6.6']],
    messages: [['p', 'M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z'], ['p', 'M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1']],
    clock: [['c', 12, 12, 10], ['p', 'M12 6v6l4 2']],
    settings: [['p', 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'], ['c', 12, 12, 3]],
    compose: [['p', 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'], ['p', 'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z']]
  };
  // “进行中”3×3 点阵：沿对角线流动的明暗（原片逐帧在变，属装饰性加载动画）
  function gridAlpha(t, i) { var cx = i % 3, cy = (i / 3) | 0; return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 0.9 - (cx + cy) * 0.17 - cy * 0.07))); }
  function gridScale(a) { return 0.55 + 0.45 * a; }

  // ---------- 文字分段：中文 / 西文 / emoji；中西文交界处按原片补 1/8em 间隙（text-autospace 的效果） ----------
  var CJK_RE = /[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/, IDEO_RE = /[\u3400-\u9FFF]/;
  function textRuns(str) {
    var out = [], cur = null, chars = Array.from(str);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], k = ch === '✨' ? 'emoji' : (CJK_RE.test(ch) ? 'cjk' : 'lat');
      if (!cur || cur.k !== k) { cur = { s: '', k: k, gap: false }; out.push(cur); }
      cur.s += ch;
    }
    for (var j = 1; j < out.length; j++) {
      var a = out[j - 1], b = out[j], al = a.s.charAt(a.s.length - 1), bf = b.s.charAt(0);
      if ((a.k === 'cjk' && b.k === 'lat' && IDEO_RE.test(al) && /[A-Za-z0-9]/.test(bf)) || (a.k === 'lat' && b.k === 'cjk' && IDEO_RE.test(bf) && /[A-Za-z0-9]/.test(al))) b.gap = true;
    }
    return out;
  }

  // 橡皮筋（交互模式越界）
  function rubber(over, dim) { return (1 - 1 / (over * 0.55 / dim + 1)) * dim; }

  return { W: W, H: H, L: L, C: C, SECTIONS: SECTIONS, LAYOUT: LAYOUT, BLUR: BLUR, FADE: FADE, FADE_BOTTOM: FADE_BOTTOM,
    labelStates: labelStates, labelTracks: labelTracks, indicator: indicator, scrollAt: scrollAt, indicatorOpacityAt: indicatorOpacityAt, frame: frame, frameAtScroll: frameAtScroll,
    lerpTable: lerpTable, rubber: rubber, ICONS: ICONS, gridAlpha: gridAlpha, gridScale: gridScale, textRuns: textRuns, DUR: DUR, FPS: FPS, SCROLL: SCROLL, SCROLL_F0: SCROLL_F0 };
});
