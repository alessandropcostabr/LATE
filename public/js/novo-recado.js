// public/js/novo-recado.js
// Página "Novo Recado" — coleta do formulário, normalização e envio para a API.
// Por quê: garantir JSON válido e presença de 'mensagem' (fallback de 'observacoes').

(() => {
  console.log('✅ Novo Recado JS carregado');

  // Helper seguro para capturar valor de input/textarea
  const val = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return '';
    return String(el.value || '').trim();
  };

  function coletarDados() {
    const data_ligacao = val('#data_ligacao');
    const hora_ligacao = val('#hora_ligacao');
    const destinatario = val('#destinatario');
    const remetente_nome = val('#remetente_nome');
    const remetente_telefone = val('#remetente_telefone');
    const remetente_email = val('#remetente_email');
    const assunto = val('#assunto');
    const situacao = val('#situacao') || 'pendente';
    const horario_retorno = val('#horario_retorno');
    const observacoes = val('#observacoes');

    // 'mensagem' pode não existir no template atual; tentamos capturar, senão criamos fallback
    const mensagemRaw = val('#mensagem'); // se não existir, retorna ''
    const mensagem = (mensagemRaw || observacoes || '(sem mensagem)');

    const payload = {
      data_ligacao,
      hora_ligacao,
      destinatario,
      remetente_nome,
      remetente_telefone,
      remetente_email,
      assunto,
      mensagem,            // <- obrigatório no banco; garantimos aqui
      situacao,
      horario_retorno,
      observacoes
    };

    console.log('✅ Dados coletados:', payload);
    return payload;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    try {
      const recado = coletarDados();

      // Validação mínima no front para UX (backend também valida)
      const faltando = [];
      if (!recado.data_ligacao) faltando.push('Data da ligação');
      if (!recado.hora_ligacao) faltando.push('Hora da ligação');
      if (!recado.destinatario) faltando.push('Destinatário');
      if (!recado.remetente_nome) faltando.push('Remetente');
      if (!recado.assunto) faltando.push('Assunto');
      if (!recado.mensagem) faltando.push('Mensagem');

      if (faltando.length) {
        alert(`Preencha os campos obrigatórios: ${faltando.join(', ')}`);
        return;
      }

      const resp = await API.createRecado(recado);
      console.log('✅ Recado criado:', resp);

      // Redireciona para lista/detalhe após criar (ajuste conforme sua navegação)
      if (resp?.sucesso) {
        window.location.href = '/recados';
      } else {
        alert('Não foi possível criar o recado.');
      }
    } catch (err) {
      console.error('❌ Erro do servidor:', err?.message || err);
      alert(err?.message || 'Erro ao salvar recado. Tente novamente.');
    }
  }

  function iniciar() {
    const form = document.querySelector('#form-novo-recado') || document.querySelector('form');
    if (!form) {
      console.warn('⚠️ Formulário de novo recado não encontrado.');
      return;
    }
    form.addEventListener('submit', handleSubmit);
    console.log('✅ Manipuladores de evento configurados para Novo Recado');
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();

