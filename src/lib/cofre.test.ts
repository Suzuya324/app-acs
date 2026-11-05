import { describe, expect, it } from 'vitest';
import { armazenamentoMemoria } from './armazenamento';
import { ArquivoInvalido, criarBackup, lerBackup, SenhaBackupErrada } from './backup';
import { Cofre, PinErrado, type Dados } from './cofre';
import { esperaAposErros, problemaNoPin } from './cripto';
import { CONFIG_PADRAO } from './rotulos';

// Poucas repetições só para os testes ficarem rápidos (no app são 600 mil).
const IT = 1000;

const dados = (): Dados => ({
  config: { ...CONFIG_PADRAO, nomeAcs: 'Agente Teste' },
  familias: [
    {
      id: 'f1', rua: 'Rua Teste', numero: '10', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001',
      situacaoCasa: 'habitada', obs: '', responsavelId: '',
      moradores: [{ id: 'm1', nome: 'Fulana Teste', sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
    },
  ],
  visitas: [],
  historico: [],
});

describe('cofre criptografado', () => {
  it('fecha, abre com o PIN e os dados continuam lá', async () => {
    const armaz = armazenamentoMemoria();
    const c1 = new Cofre(armaz, IT);
    expect(await c1.existe()).toBe(false);
    await c1.criar('482916', dados());
    c1.trancar();

    // "Fechou o app e abriu de novo": novo cofre, mesmo armazenamento.
    const c2 = new Cofre(armaz, IT);
    expect(await c2.existe()).toBe(true);
    const lidos = await c2.abrir('482916');
    expect(lidos.familias[0].moradores[0].nome).toBe('Fulana Teste');
    expect(lidos.config.nomeAcs).toBe('Agente Teste');
  });

  it('nada fica gravado legível (nome do morador não aparece)', async () => {
    const armaz = armazenamentoMemoria();
    await new Cofre(armaz, IT).criar('482916', dados());
    const tudo = JSON.stringify([...armaz.bruto.values()], (_k, v) =>
      v instanceof Uint8Array ? new TextDecoder('latin1').decode(v) : v,
    );
    expect(tudo).not.toContain('Fulana');
    expect(tudo).not.toContain('Rua Teste');
    expect(tudo).not.toContain('482916');
  });

  it('PIN errado não abre e conta os erros; PIN certo zera a contagem', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, IT);
    await c.criar('482916', dados());
    c.trancar();
    await expect(c.abrir('000001')).rejects.toBeInstanceOf(PinErrado);
    await expect(c.abrir('482917')).rejects.toBeInstanceOf(PinErrado);
    expect((await c.tentativas()).erros).toBe(2);
    expect(c.aberto).toBe(false);
    await c.abrir('482916');
    expect((await c.tentativas()).erros).toBe(0);
  });

  it('grava alterações e elas voltam ao reabrir', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, IT);
    const d = dados();
    await c.criar('482916', d);
    d.config.metaMensal = 180;
    await c.gravar({ config: d.config });
    c.trancar();
    expect((await c.abrir('482916')).config.metaMensal).toBe(180);
  });

  it('não grava com o cofre trancado', async () => {
    const c = new Cofre(armazenamentoMemoria(), IT);
    await expect(c.gravar({ visitas: [] })).rejects.toThrow();
  });

  it('troca o PIN: o antigo para de funcionar', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, IT);
    await c.criar('482916', dados());
    await c.trocarPin('735102', dados());
    c.trancar();
    await expect(c.abrir('482916')).rejects.toBeInstanceOf(PinErrado);
    expect((await c.abrir('735102')).familias).toHaveLength(1);
  });

  it('apagar tudo remove o cofre', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, IT);
    await c.criar('482916', dados());
    await c.apagarTudo();
    expect(await c.existe()).toBe(false);
  });
});

describe('backup criptografado', () => {
  it('gera arquivo sem dados legíveis e restaura com a senha', async () => {
    const texto = await criarBackup(dados(), 'senha-forte-123', IT);
    expect(texto).not.toContain('Fulana');
    const volta = await lerBackup(texto, 'senha-forte-123');
    expect(volta.familias[0].prontuario).toBe('00.0001');
  });

  it('senha errada não abre', async () => {
    const texto = await criarBackup(dados(), 'senha-forte-123', IT);
    await expect(lerBackup(texto, 'outra')).rejects.toBeInstanceOf(SenhaBackupErrada);
  });

  it('arquivo que não é backup é recusado', async () => {
    await expect(lerBackup('{"oi":1}', 'x')).rejects.toBeInstanceOf(ArquivoInvalido);
    await expect(lerBackup('não é json', 'x')).rejects.toBeInstanceOf(ArquivoInvalido);
  });

  it('arquivo alterado é recusado', async () => {
    const a = JSON.parse(await criarBackup(dados(), 'senha-forte-123', IT));
    a.dados = a.dados.slice(0, -8) + 'AAAAAAA=';
    await expect(lerBackup(JSON.stringify(a), 'senha-forte-123')).rejects.toBeInstanceOf(SenhaBackupErrada);
  });
});

describe('regras do PIN', () => {
  it('exige 6 números ou mais e recusa os óbvios', () => {
    expect(problemaNoPin('12345')).toMatch(/6 números/);
    expect(problemaNoPin('12a456')).toMatch(/só números/);
    expect(problemaNoPin('111111')).toMatch(/repetido/);
    expect(problemaNoPin('123456')).toMatch(/sequência/);
    expect(problemaNoPin('987654')).toMatch(/sequência/);
    expect(problemaNoPin('482916')).toBe('');
    expect(problemaNoPin('48291673')).toBe('');
  });

  it('espera cada vez maior depois de erros seguidos', () => {
    expect(esperaAposErros(2)).toBe(0);
    expect(esperaAposErros(3)).toBe(5);
    expect(esperaAposErros(4)).toBe(10);
    expect(esperaAposErros(20)).toBe(300);
  });
});

describe('extras do aparelho (sincronização)', () => {
  it('ficam criptografados, sobrevivem à troca de PIN e não entram nos dados', async () => {
    const armaz = armazenamentoMemoria();
    const cofre = new Cofre(armaz, IT);
    await cofre.criar('123456', dados());
    await cofre.gravarExtra('sinc', { token: 'segredo-inventado' });
    expect(JSON.stringify([...armaz.bruto.values()])).not.toContain('segredo-inventado');
    await cofre.trocarPin('654321', dados());
    cofre.trancar();
    const d = await cofre.abrir('654321');
    expect(JSON.stringify(d)).not.toContain('segredo-inventado');
    expect(await cofre.lerExtra('sinc')).toEqual({ token: 'segredo-inventado' });
    await cofre.gravarExtra('sinc', null);
    expect(await cofre.lerExtra('sinc')).toBeNull();
  });
});

describe('arquivo errado no lugar do backup', () => {
  it('diz que é o de conexão ou o do Sistema de Visitas', async () => {
    await expect(lerBackup('{"formato":"facilitador-conexao","versao":1}', 'x')).rejects.toThrow(/arquivo de conexão/);
    await expect(lerBackup('{"formato":"facilitador-importacao","versao":1,"itens":[]}', 'x')).rejects.toThrow(/Sistema de Visitas/);
    await expect(lerBackup('nada', 'x')).rejects.toThrow(ArquivoInvalido);
  });
});
