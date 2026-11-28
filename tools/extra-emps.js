/* Empreendimentos acrescentados direto pelo repositório (o gerador injeta no index.html).
   Só dados confirmados nos materiais do Renan. Imagens com caminho local (/midia/...). */
EMPS.push({
  id: 'dona-alzira', nome: 'Residencial Dona Alzira', incorp: 'Domingues Construções', cidade: 'Itapoá', bairro: 'Paese',
  endereco: 'Rua 1050 Abrahão Bittencourt Neto, 404 · Paese · 350 m do mar', status: 'Em obra', entrega: '2028-11', pronto: false,
  tabela: 'Tabela Construtora DC · vigência 05/11/2026', correcao: 'Condições de pagamento sob consulta com o corretor.', aviso: 'Valores podem mudar sem aviso prévio.',
  cor: ['#13233F', '#C29A4E'],
  resumo: 'Prédio exclusivo de 6 pavimentos e apenas 9 apartamentos, todos com 3 quartos (1 suíte), 88,55 m² privativos e 2 vagas, a 350 m do mar no Paese.',
  ficha: [['Apartamentos', '3 quartos (1 suíte) · 88,55 m² privativos · 2 vagas (as do 102 são descobertas)'], ['Prédio', '6 pavimentos · 9 apartamentos (2 por andar do 1º ao 4º) · elevador'],
    ['Disponíveis', '102, 201, 301, 401, 402 e 501 (tabela de 05/11/2026)'], ['Posição', 'Finais 01 de frente para a Rua 1050 · finais 02 para a Rua 1040'],
    ['Obra', 'Início em 15/12/2025 · entrega prevista nov/2028 (tabela)'], ['Registro', 'Incorporação registrada (R-15) com patrimônio de afetação']],
  lazer: ['Salão de festas na cobertura', 'Terraço com pergolado', 'Cozinha gourmet'],
  dif: ['350 m do mar', 'Sacada com churrasqueira', 'Porcelanato em todo o apartamento', 'Infraestrutura para ar-condicionado split', 'Elevador', 'Patrimônio de afetação'],
  condicoes: []
});
/* Unidades disponíveis · tabela Construtora DC de 05/11/2026 (planilha Captações João, aba DC). 101, 202 e 302 vendidos. */
[['102', 689900, '1º', 'Rua 1040', 'Vagas 01 e 02 (descobertas)'], ['201', 758800, '2º', 'Rua 1050', 'Vagas 15 e 16'],
 ['301', 819500, '3º', 'Rua 1050', 'Vagas 13 e 14'], ['401', 857300, '4º', 'Rua 1050', 'Vagas 11 e 12'],
 ['402', 857300, '4º', 'Rua 1040', 'Vagas 07 e 08'], ['501', 909700, '5º · cobertura', 'Rua 1050', 'Vagas 09 e 10']].forEach(([k, v, and, frente, vg]) =>
  UNITS.push({ emp: 'dona-alzira', un: k, key: k, q: 3, quartos: '3 quartos (1 suíte)', area: 88.55, vaga: vg,
    pos: and + ' pavimento · de frente para a ' + frente, destaque: k === '501', valor: v,
    fluxos: [{ nome: 'Valor de tabela', linhas: [['Valor da unidade · condições de pagamento sob consulta', 1, v, '#1D4A55']] }] }));
//--IMGS--
IMGS['dona-alzira'] = ['/midia/dona-alzira/fachada.jpg', '/midia/dona-alzira/interno1.jpg', '/midia/dona-alzira/interno2.jpg', '/midia/dona-alzira/interno3.jpg', '/midia/dona-alzira/interno4.jpg'];
MAPQ_EXTRA['dona-alzira'] = 'Rua 1050 Abrahão Bittencourt Neto, 404, Paese, Itapoá - SC';
