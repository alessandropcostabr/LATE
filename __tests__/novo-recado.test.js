const { JSDOM } = require('jsdom');

describe('Validação do formulário de novo recado', () => {
  let alertMock;

  beforeAll(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.FormData = dom.window.FormData;
  });

  afterAll(() => {
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.FormData;
    delete global.alert;
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="formNovoRecado">
        <input name="destinatario" value="Alice" />
        <input name="remetente_nome" value="Bob" />
        <input name="assunto" value="Teste" />
        <input name="data_ligacao" value="" />
        <input name="hora_ligacao" value="" />
        <button type="submit">Salvar Recado</button>
      </form>
    `;

    alertMock = jest.fn();
    global.alert = alertMock;
    window.alert = alertMock;

    delete require.cache[require.resolve('../public/js/novo-recado.js')];
    require('../public/js/novo-recado.js');
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
  });

  test('exibe mensagens específicas para data e hora ausentes', () => {
    const form = document.getElementById('formNovoRecado');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    expect(alertMock).toHaveBeenCalledTimes(1);
    const message = alertMock.mock.calls[0][0];
    expect(message).toContain('Data da ligação é obrigatória');
    expect(message).toContain('Hora da ligação é obrigatória');
  });
});
