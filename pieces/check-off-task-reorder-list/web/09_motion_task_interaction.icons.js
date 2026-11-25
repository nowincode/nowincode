// Shared SVG markup (pt units). HTML injects it as innerHTML; RN renders it with react-native-svg's SvgXml.
// envelope / compass / calendar are drawn here (no close-enough licensed 3D asset); briefcase + star are Fluent Emoji 3D (MIT).
(function (root) {
  'use strict';

  var ICONS = {
    envelope: { w: 28, h: 19, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="19" viewBox="0 0 28 19">' +
      '<defs><linearGradient id="eb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FB6FF"/><stop offset="1" stop-color="#1F8CEB"/></linearGradient>' +
      '<linearGradient id="ef" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9E0FF"/><stop offset="1" stop-color="#6CBBFF"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="28" height="19" rx="3.2" fill="url(#eb)"/>' +
      '<path d="M1.2 0.9 Q14 9.2 14 9.2 Q14 9.2 26.8 0.9 Q26.2 0.2 25 0.2 L3 0.2 Q1.8 0.2 1.2 0.9 Z" fill="url(#ef)"/>' +
      '<path d="M1.6 1.2 L12.4 9.4 Q14 10.6 15.6 9.4 L26.4 1.2" fill="none" stroke="#E3F2FF" stroke-opacity="0.75" stroke-width="0.9" stroke-linejoin="round"/>' +
      '</svg>' },

    compass: { w: 28, h: 28, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
      '<defs><linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9CCF8"/><stop offset="1" stop-color="#3F82E6"/></linearGradient>' +
      '<radialGradient id="cf" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4EBF2"/></radialGradient></defs>' +
      '<circle cx="14" cy="14" r="13.6" fill="url(#cr)"/>' +
      '<circle cx="14" cy="14" r="10.8" fill="url(#cf)"/>' +
      '<g transform="rotate(45 14 14)">' +
      '<path d="M14 4.6 L16.2 14 L11.8 14 Z" fill="#F2405A"/>' +
      '<path d="M11.8 14 L16.2 14 L14 23.4 Z" fill="#4A86E8"/>' +
      '</g><circle cx="14" cy="14" r="0.9" fill="#FFFFFF"/>' +
      '</svg>' },

    calendar: { w: 24, h: 26, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="26" viewBox="0 0 24 26">' +
      '<defs><linearGradient id="kr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F86B4F"/><stop offset="1" stop-color="#EE5229"/></linearGradient>' +
      '<linearGradient id="kw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEF1F3"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="24" height="26" rx="4.4" fill="url(#kw)"/>' +
      '<path d="M0 12.6 L24 12.6 L24 21.6 Q24 26 19.6 26 L4.4 26 Q0 26 0 21.6 Z" fill="url(#kr)"/>' +
      '<rect x="0" y="12.6" width="24" height="0.8" fill="#FFFFFF" fill-opacity="0.35"/>' +
      '<text x="12" y="10.1" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, \'SF Pro Text\', Helvetica, Arial, sans-serif" font-size="8.2" font-weight="700" fill="#EE5229">S</text>' +
      '<text x="12" y="22.6" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, \'SF Pro Text\', Helvetica, Arial, sans-serif" font-size="8.6" font-weight="700" fill="#FFFFFF">26</text>' +
      '</svg>' },

    clock: { w: 13, h: 13, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13">' +
      '<circle cx="6.5" cy="6.5" r="6.5" fill="#B3B3B3"/>' +
      '<path d="M6.5 3 L6.5 6.8 L8.9 8.6" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' },

    // white tick used inside the filled check (26pt circle)
    tick: { w: 26, h: 26, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' +
      '<path d="M8.3 13.4 L11.3 16.3 L17.5 9.6" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' },

    signal: { w: 18, h: 12, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="12" viewBox="0 0 18 12" fill="#000">' +
      '<rect x="0" y="7.5" width="3.2" height="4.5" rx="0.9"/><rect x="4.8" y="5.2" width="3.2" height="6.8" rx="0.9"/>' +
      '<rect x="9.6" y="2.7" width="3.2" height="9.3" rx="0.9"/><rect x="14.4" y="0" width="3.2" height="12" rx="0.9"/></svg>' },
    wifi: { w: 17, h: 12, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="12" viewBox="0 0 17 12" fill="#000">' +
      '<path d="M8.5 2.3c2.5 0 4.8 1 6.5 2.6l1.3-1.3A11 11 0 0 0 8.5 0.4 11 11 0 0 0 0.7 3.6L2 4.9a9.2 9.2 0 0 1 6.5-2.6z"/>' +
      '<path d="M8.5 5.9c1.5 0 2.9 0.6 3.9 1.6l1.3-1.3a7.3 7.3 0 0 0-10.4 0l1.3 1.3c1-1 2.4-1.6 3.9-1.6z"/>' +
      '<path d="M8.5 9.3c0.6 0 1.1 0.2 1.5 0.6L8.5 11.6 7 9.9c0.4-0.4 0.9-0.6 1.5-0.6z"/></svg>' },
    battery: { w: 27, h: 13, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="13" viewBox="0 0 27 13">' +
      '<rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="#000" stroke-opacity="0.35"/>' +
      '<rect x="2" y="2" width="20" height="9" rx="2.5" fill="#000"/>' +
      '<path d="M25 4.4v4.2c0.8-0.3 1.4-1.2 1.4-2.1s-0.6-1.8-1.4-2.1z" fill="#000" fill-opacity="0.4"/></svg>' },

    // tab bar glyphs, 22pt box; {c} is replaced by the ink colour
    home: { w: 22, h: 22, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
      '<path d="M3 9.6 Q3 8.6 3.8 8 L9.8 3.4 Q11 2.5 12.2 3.4 L18.2 8 Q19 8.6 19 9.6 L19 17.6 Q19 19.4 17.2 19.4 L14 19.4 L14 14.6 Q14 12.8 12.2 12.8 L9.8 12.8 Q8 12.8 8 14.6 L8 19.4 L4.8 19.4 Q3 19.4 3 17.6 Z" fill="{c}"/></svg>' },
    tasks: { w: 22, h: 22, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
      '<rect x="2.5" y="2.5" width="17" height="17" rx="3.6" fill="{c}"/>' +
      '<path d="M5.6 7.6 L7 9 L9.4 6.4 M5.6 13.6 L7 15 L9.4 12.4" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M12.2 7.8 L16.2 7.8 M12.2 13.8 L16.2 13.8" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    calendarTab: { w: 22, h: 22, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
      '<rect x="2.5" y="4" width="17" height="15.5" rx="3.4" fill="{c}"/>' +
      '<rect x="6" y="2" width="1.8" height="4.4" rx="0.9" fill="{c}"/><rect x="14.2" y="2" width="1.8" height="4.4" rx="0.9" fill="{c}"/>' +
      '<rect x="2.5" y="8.6" width="17" height="1.3" fill="#F3F3F3"/></svg>' },
    stats: { w: 22, h: 22, xml:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="{c}">' +
      '<rect x="3" y="12" width="3.6" height="7.4" rx="1.8"/><rect x="9.2" y="2.8" width="3.6" height="16.6" rx="1.8"/>' +
      '<rect x="15.4" y="8.6" width="3.6" height="10.8" rx="1.8"/></svg>' }
  };

  function xml(name, color) { return ICONS[name].xml.replace(/\{c\}/g, color || '#000'); }

  var api = { ICONS: ICONS, xml: xml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaskIcons = api;
})(typeof window !== 'undefined' ? window : this);
