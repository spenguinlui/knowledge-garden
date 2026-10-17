export function browserScript(): string {
  return `(function () {
  var ID = "kg-tag-editor";
  var loadSequence = 0;

  function slug() {
    var match = location.pathname.match(/^\\/notes\\/([^/]+)\\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function removeEditor() {
    var old = document.getElementById(ID);
    if (old) old.remove();
  }

  function shell() {
    removeEditor();
    var editor = document.createElement("div");
    editor.id = ID;
    var title = document.querySelector(".article-title");
    if (title) title.insertAdjacentElement("afterend", editor);
    else {
      var article = document.querySelector("article");
      if (article && article.parentElement) article.parentElement.insertBefore(editor, article);
    }
    return editor;
  }

  function element(name, attributes, text) {
    var node = document.createElement(name);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function draw(editor, data, noteSlug) {
    var source = data.tags.filter(function (tag) { return tag.indexOf("from/") === 0; });
    var detail = data.tags.slice(1).filter(function (tag) { return tag.indexOf("from/") !== 0; });
    var row = element("div", { class: "kg-tag-row" });
    var select = element("select", { id: "kg-main-category", "aria-label": "主分類" });
    data.mainCategories.forEach(function (tag) {
      var option = element("option", { value: tag }, tag);
      if (tag === data.tags[0]) option.selected = true;
      select.appendChild(option);
    });
    row.appendChild(select);

    var detailBox = element("span", { class: "kg-detail-tags" });
    function drawDetails() {
      detailBox.replaceChildren();
      detail.forEach(function (tag) {
        var button = element("button", { type: "button", class: "kg-tag-remove", "data-tag": tag }, tag);
        button.addEventListener("click", function () {
          detail = detail.filter(function (item) { return item !== tag; });
          drawDetails();
        });
        detailBox.appendChild(button);
      });
    }
    drawDetails();
    row.appendChild(detailBox);

    var input = element("input", { id: "kg-tag-input", list: "kg-tag-options", placeholder: "新增標籤" });
    var choices = element("datalist", { id: "kg-tag-options" });
    Object.keys(data.tagCounts).filter(function (tag) {
      return data.mainCategories.indexOf(tag) === -1 && tag.indexOf("from/") !== 0;
    }).sort().forEach(function (tag) { choices.appendChild(element("option", { value: tag })); });
    row.appendChild(input);
    row.appendChild(choices);
    var add = element("button", { type: "button", id: "kg-tag-add" }, "加入");
    function addInput() {
      var tag = input.value;
      if (tag && detail.indexOf(tag) === -1) detail.push(tag);
      input.value = "";
      drawDetails();
    }
    add.addEventListener("click", addInput);
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addInput();
    });
    row.appendChild(add);
    source.forEach(function (tag) { row.appendChild(element("span", { class: "kg-source-tag" }, tag)); });

    var save = element("button", { type: "button", id: "kg-tag-save" }, "儲存");
    var status = element("div", { class: "kg-tag-status", "aria-live": "polite" });
    save.addEventListener("click", async function () {
      addInput();
      var tags = [select.value].concat(detail, source);
      try {
        var response = await fetch("/api/notes/" + encodeURIComponent(noteSlug) + "/tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: tags })
        });
        if (response.ok) status.textContent = "已儲存，網站約 1 分鐘後更新";
        else {
          var problem = await response.json().catch(function () { return {}; });
          status.textContent = problem.error || "儲存失敗";
        }
      } catch (_) {
        status.textContent = "儲存失敗";
      }
    });
    row.appendChild(save);
    editor.replaceChildren(row, status);
  }

  async function load() {
    var sequence = ++loadSequence;
    removeEditor();
    var noteSlug = slug();
    if (!noteSlug) return;
    var editor = shell();
    try {
      var response = await fetch("/api/notes/" + encodeURIComponent(noteSlug));
      if (sequence !== loadSequence) return;
      if (!response.ok) {
        editor.textContent = "讀不到這篇的標籤";
        return;
      }
      var data = await response.json();
      if (sequence !== loadSequence) return;
      draw(editor, data, noteSlug);
    } catch (_) {
      if (sequence === loadSequence) editor.textContent = "讀不到這篇的標籤";
    }
  }

  load();
  if (!window.__kgTagEditor) {
    window.__kgTagEditor = true;
    document.addEventListener("nav", load);
  }
})();
`;
}
