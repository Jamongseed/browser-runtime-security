(() => {
  const _g = (function() { return this; })(); // 전역 객체(window) 은닉
  const _d = _g["docu" + "ment"];             // 문서 객체(document) 은닉
  
  //원래는 localhost4000 나타낸거였습니다.
  const _addr = [104, 116, 116, 112, 58, 47, 47, 108, 111, 99, 97, 108, 104, 111, 115, 116, 58, 52, 48, 48, 48];
  const ORIGIN = _g["Str" + "ing"]["fromCha" + "rCode"](..._addr);

  console.log("[thirdparty sdk] loaded");

  function injectAdWidget() {
    if (document.getElementById("adWidgetContainer")) return;


    const container = document.createElement("div");
    container.id = "adWidgetContainer";
    container.dataset.poc = "ad-widget";
    container.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 320px;
      height: 260px;
      z-index: 999999;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      background: white;
    `;
    

    const close = document.createElement("button");
    close.textContent = "닫기";
    close.setAttribute("aria-label", "close-ad");
    close.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid #ddd;
      background: rgba(255,255,255,0.95);
      cursor: pointer;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 13px;
    `;

    close.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.remove();
      console.log("[thirdparty sdk] ad closed (container removed)");
    });

    //iframe생성, 4000번 페이지가 담긴 창
    const _tag = [105, 102, 114, 97, 109, 101].map(c => _g["Str" + "ing"]["fromCha" + "rCode"](c)).join("");
    const ifr = _d["creat" + "eElem" + "ent"](_tag);
    const _p = "s" + "rc";
    const _v = ORIGIN + "/wid" + "get.ht" + "ml";
    _g["Obj" + "ect"]["defin" + "ePrope" + "rty"](ifr, _p, {
    ["val" + "ue"]: _v,
    ["writ" + "able"]: !0,     // true 대신 !0 사용
    ["config" + "urable"]: !!1 // true 대신 !!1 사용
    });
    ifr["sty" + "le"]["css" + "Text"] = "border:0;width:100%;height:100%;";
    ifr["setAt" + "trib" + "ute"]("ti" + "tle", "Ad Wid" + "get");

    const _append = "app" + "end" + "Child";
    // container.appendChild(close) 우회
    _g["Ref" + "lect"]["apply"](container[_append], container, [close]);

    // container.appendChild(ifr) 우회
    _g["Ref" + "lect"]["apply"](container[_append], container, [ifr]);

    // document.documentElement.appendChild(container) 우회
    const _root = _d["docu" + "mentElem" + "ent"];
    _g["Ref" + "lect"]["apply"](_root[_append], _root, [container]);
  }

  document.addEventListener("DOMContentLoaded", injectAdWidget);//html이 완성되면 injectAdWidget 함수실행하쇼
})();
