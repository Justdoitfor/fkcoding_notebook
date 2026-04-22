import { notesApi, uploadApi } from '../api.js';
import { store } from '../store.js';

export class EditorView {
  constructor(container, params) {
    this.container = container;
    this.id = params?.id || null;
    this.note = { title: '未命名笔记', content: '', status: 'draft', category_id: null, tags: [] };
    this.saveTimer = null;
  }

  async render() {
    this.container.innerHTML = \`<div style="padding:20px">加载中...</div>\`;

    if (this.id) {
      try {
        this.note = await notesApi.get(this.id);
      } catch (e) {
        window.showToast?.('笔记不存在或获取失败', 'error');
        return;
      }
    }

    const categories = store.getState('categories') || [];
    
    const html = \`
      <div style="display:flex;height:calc(100vh - 52px);overflow:hidden;width:100%">
        <div class="editor-panel" style="flex:1;max-width:50%">
          <div class="editor-toolbar">
            <input type="text" id="note-title" value="\${this.note.title}" style="border:none;outline:none;font-weight:600;font-size:14px;padding:4px;flex:1">
            <div class="tb-sep"></div>
            <select id="note-category" style="border:none;outline:none;background:none;font-size:12px;color:var(--ink2)">
              <option value="">未分类</option>
              \${categories.map(c => \`<option value="\${c.id}" \${this.note.category_id===c.id?'selected':''}>\${c.name}</option>\`).join('')}
            </select>
            <div class="tb-sep"></div>
            <button class="tb-btn" id="btn-img">🖼 图片</button>
            <input type="file" id="file-img" accept="image/*" style="display:none">
            <div style="margin-left:auto;display:flex;gap:4px">
              <span id="save-status" style="font-size:11px;color:var(--ink3);align-self:center;margin-right:10px">已保存</span>
              <button class="btn btn-accent" id="btn-publish" style="font-size:12px;padding:4px 12px">\${this.note.status==='published'?'更新发布':'发布'}</button>
            </div>
          </div>
          <textarea class="editor-textarea" id="mdEditor" spellcheck="false">\${this.note.content}</textarea>
        </div>

        <div class="preview-panel" style="flex:1">
          <div class="preview-header">
            <span>实时预览</span>
          </div>
          <div class="preview-body">
            <div class="md-preview" id="preview"></div>
          </div>
        </div>

        <div class="toc-sidebar" style="display:none">
          <div class="toc-title">目录</div>
          <div id="toc-list"></div>
        </div>
      </div>
    \`;

    this.container.innerHTML = html;
    this.setupMarked();
    this.bindEvents();
    this.renderPreview();
  }

  setupMarked() {
    if (window.marked && window.hljs) {
      window.marked.setOptions({
        highlight: (code, lang) => {
          const language = window.hljs.getLanguage(lang) ? lang : 'plaintext';
          return window.hljs.highlight(code, { language }).value;
        },
        gfm: true,
        breaks: true
      });
    }
  }

  bindEvents() {
    const titleInput = this.container.querySelector('#note-title');
    const categorySelect = this.container.querySelector('#note-category');
    const textarea = this.container.querySelector('#mdEditor');
    const publishBtn = this.container.querySelector('#btn-publish');
    const imgBtn = this.container.querySelector('#btn-img');
    const fileImg = this.container.querySelector('#file-img');

    const triggerSave = () => {
      this.note.title = titleInput.value;
      this.note.category_id = categorySelect.value || null;
      this.note.content = textarea.value;
      this.setStatus('saving');
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.save(), 1000);
      this.renderPreview();
    };

    titleInput.addEventListener('input', triggerSave);
    categorySelect.addEventListener('change', triggerSave);
    textarea.addEventListener('input', triggerSave);

    publishBtn.addEventListener('click', async () => {
      this.note.status = 'published';
      await this.save(true);
      window.showToast?.('已发布 🎉', 'success');
      publishBtn.textContent = '更新发布';
    });

    imgBtn.addEventListener('click', () => fileImg.click());
    fileImg.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const res = await uploadApi.upload({
            filename: file.name,
            mime_type: file.type,
            data: reader.result,
            note_id: this.id
          });
          const imgMd = \`\\n![\${file.name}](\${res.url})\\n\`;
          const pos = textarea.selectionStart;
          textarea.value = textarea.value.slice(0, pos) + imgMd + textarea.value.slice(pos);
          triggerSave();
          window.showToast?.('图片上传成功', 'success');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        window.showToast?.(err.message || '上传失败', 'error');
      }
    });
  }

  setStatus(status) {
    const el = this.container.querySelector('#save-status');
    if (!el) return;
    if (status === 'saving') el.textContent = '保存中...';
    if (status === 'saved') el.textContent = '已保存 ✓';
    if (status === 'error') el.textContent = '保存失败!';
  }

  async save(force = false) {
    try {
      if (this.id) {
        await notesApi.update(this.id, this.note);
      } else {
        const res = await notesApi.create(this.note);
        this.id = res.id;
        window.history.replaceState({}, '', \`/editor/\${this.id}\`);
      }
      this.setStatus('saved');
    } catch (e) {
      console.error(e);
      this.setStatus('error');
    }
  }

  renderPreview() {
    const textarea = this.container.querySelector('#mdEditor');
    const preview = this.container.querySelector('#preview');
    if (!textarea || !preview) return;

    let html = '';
    if (window.marked) {
      html = window.marked.parse(textarea.value);
    } else {
      html = textarea.value; // Fallback
    }

    // Callout custom syntax > [!NOTE] 
    html = html.replace(/<blockquote>\\s*<p>\\[!(NOTE|WARNING|TIP)\\](.*?)<\\/p>\\s*<\\/blockquote>/gs, (match, type, content) => {
      const cls = type === 'WARNING' ? 'callout-warn' : 'callout-tip';
      const icon = type === 'WARNING' ? '⚠️' : '💡';
      return \`<div class="callout \${cls}">\${icon} \${content}</div>\`;
    });

    preview.innerHTML = html;

    // Render Math
    if (window.renderMathInElement) {
      window.renderMathInElement(preview, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  }
}
