const { JSDOM } = require('jsdom');

describe('Loading utility', () => {
  beforeAll(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.navigator = dom.window.navigator;
    require('../public/js/utils.js');
  });

  afterAll(() => {
    delete require.cache[require.resolve('../public/js/utils.js')];
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.navigator;
  });

  beforeEach(() => {
    document.body.innerHTML = '<button id="btn1">Save</button><button id="btn2">Send</button>';
  });

  test('show and hide by id', () => {
    const btn = document.getElementById('btn1');
    window.Loading.show('btn1');
    expect(btn.disabled).toBe(true);
    expect(btn.dataset.originalText).toBe('Save');
    expect(btn.innerHTML).toMatch(/loading/);

    window.Loading.hide('btn1');
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('Save');
    expect(btn.dataset.originalText).toBeUndefined();
  });

  test('show and hide by element', () => {
    const btn = document.getElementById('btn2');
    window.Loading.show(btn);
    expect(btn.disabled).toBe(true);
    expect(btn.dataset.originalText).toBe('Send');
    expect(btn.innerHTML).toMatch(/loading/);

    window.Loading.hide(btn);
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('Send');
    expect(btn.dataset.originalText).toBeUndefined();
  });
});
