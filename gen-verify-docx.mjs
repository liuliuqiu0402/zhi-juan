// 生成田字格验证文档：行中压字场景 + 表格连续 br 空行场景
import { JSDOM } from 'jsdom';
import { Packer } from 'docx';
import fs from 'fs';
import { buildDocxFromDom } from './src/utils/docxBuilder.js';
import { injectDrawingML } from './src/utils/drawingMLShapes.js';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;

const container = document.createElement('div');
container.style.fontSize = '16px';
container.innerHTML = `
  <p>正确写法：小刺<span class="tian-zi-ge">猬</span>猬去采果子。</p>
  <p>易错门诊：遇到<span class="tian-zi-ge">刺</span>字要注意右边是朿不是束。</p>
  <table><tr><td><span class="tian-zi-ge">蝌</span><br><br></td><td>（部首：虫，15画，左右结构）</td></tr></table>
  <table><tr><td><span class="tian-zi-ge">蚪</span><br>（部首：虫）</td><td>组词：蝌蚪</td></tr></table>
`;
document.body.appendChild(container);

const doc = buildDocxFromDom(container);
const buf = await Packer.toBuffer(doc);
fs.writeFileSync('d:/wisdom-workshop/verify-raw.docx', buf);
const processed = await injectDrawingML(buf);
fs.writeFileSync('d:/wisdom-workshop/verify-tzg.docx', processed);
console.log('written verify-raw.docx', buf.length, 'verify-tzg.docx', processed.length);
