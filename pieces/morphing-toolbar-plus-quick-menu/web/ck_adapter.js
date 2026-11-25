/* CanvasKit adapter for 04_motion_toolbar_menu_core (browser preview + node tools).
 * The RN component implements the same interface on @shopify/react-native-skia. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.makeCKAdapter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return function makeCKAdapter(CK, label) {
    var trash = [], paths = {}, effects = {};
    function T(o) { trash.push(o); return o; }
    function col(c) { return CK.Color4f(c[0], c[1], c[2], c[3] == null ? 1 : c[3]); }
    function paint() { var p = T(new CK.Paint()); p.setAntiAlias(true); return p; }
    return {
      Stroke: CK.PaintStyle.Stroke, CapRound: CK.StrokeCap.Round, JoinRound: CK.StrokeJoin.Round,
      ClipIntersect: CK.ClipOp.Intersect, BlendPlus: CK.BlendMode.Plus,
      paint: paint,
      imagePaint: paint,
      color: col,
      rect: function (x, y, w, h) { return CK.XYWHRect(x, y, w, h); },
      rrect: function (x, y, w, h, r) { return CK.RRectXY(CK.XYWHRect(x, y, w, h), r, r); },
      linear: function (x0, y0, x1, y1, cols, pos) {
        return T(CK.Shader.MakeLinearGradient([x0, y0], [x1, y1], cols.map(col), pos, CK.TileMode.Clamp));
      },
      radial: function (cx, cy, r, cols, pos) {
        return T(CK.Shader.MakeRadialGradient([cx, cy], r, cols.map(col), pos, CK.TileMode.Clamp));
      },
      blur: function (s) { return T(CK.ImageFilter.MakeBlur(s, s, CK.TileMode.Decal, null)); },
      blurBoost: function (s, g) {
        var cf = T(CK.ColorFilter.MakeMatrix([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, g[0], g[1]]));
        return T(CK.ImageFilter.MakeColorFilter(cf, T(CK.ImageFilter.MakeBlur(s, s, CK.TileMode.Decal, null))));
      },
      maskBlur: function (s) { return T(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, s, true)); },
      path: function (d) { return paths[d] || (paths[d] = CK.Path.MakeFromSVGString(d)); },
      bounds: function (p) { var b = p.getBounds(); return [b[0], b[1], b[2], b[3]]; },
      effect: function (name, src) {
        if (!effects[name]) {
          effects[name] = CK.RuntimeEffect.Make(src, function (e) { console.error('SkSL', e); });
        }
        return effects[name];
      },
      effectShader: function (eff, u, children) { return T(eff.makeShaderWithChildren(u, children)); },
      imageShader: function (img, a, tx, ty) {
        return T(img.makeShaderOptions(CK.TileMode.Decal, CK.TileMode.Decal, CK.FilterMode.Linear, CK.MipmapMode.None, [a, 0, tx, 0, a, ty, 0, 0, 1]));
      },
      surface: function (w, h) {
        var s = CK.MakeSurface(w, h);
        return { canvas: s.getCanvas(), snap: function () { var img = s.makeImageSnapshot(); s.delete(); return img; } };
      },
      label: label,
      endFrame: function () { while (trash.length) trash.pop().delete(); }
    };
  };
});
