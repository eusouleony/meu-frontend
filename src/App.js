// App.jsx (substitua todo o arquivo existente por este)
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AvatarEditor from 'react-avatar-editor';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  // ======= Serviços =======
  const [servicos, setServicos] = useState([]);
  const [nome, setNome] = useState('');
  const [custoBase, setCustoBase] = useState('');
  const [percentual, setPercentual] = useState(0);
  const [tecnico, setTecnico] = useState('');
  const [fotos, setFotos] = useState(() => {
    const armazenadas = localStorage.getItem('fotosTecnicos');
    return armazenadas ? JSON.parse(armazenadas) : {};
  });
  const [imagemEditor, setImagemEditor] = useState(null);
  const [tecnicoEditor, setTecnicoEditor] = useState(null);
  const [scale, setScale] = useState(1.2);
  const editorRef = useRef(null);
  const [tecnicosExpandido, setTecnicosExpandido] = useState({});
  const [tecnicoParaExportar, setTecnicoParaExportar] = useState('');

  // ======= Página (serviços / investimentos) =======
  const [pagina, setPagina] = useState('servicos');

  // ======= Investimentos =======
  const [investimentos, setInvestimentos] = useState([]);
  const [investidor, setInvestidor] = useState('');
  const [valorInvestido, setValorInvestido] = useState('');
  const [outroInvestidor, setOutroInvestidor] = useState('');
  const [mostrarOutroInvestidor, setMostrarOutroInvestidor] = useState(false);

  const investidoresPadrao = ['Lucas', 'Vitor', 'Naldo'];
  const tecnicosPadrao = ['Lucas', 'Vitor', 'Naldo'];

  const servicosPadrao = [
    'Troca de teclado',
    'Troca de tela',
    'Formatação',
    'Montagem de computador normal',
    'Montagem de computador gamer',
    'Preventiva de computador normal',
    'Preventiva de computador gamer',
  ];

  // ======= Fetch inicial de serviços e investimentos =======
  useEffect(() => {
    axios.get('http://localhost:3001/api/servicos')
      .then(res => setServicos(res.data))
      .catch(err => console.error('Erro ao buscar serviços:', err));

    // investimentos do backend (filtrando itens sem investidor)
    axios.get('http://localhost:3001/api/investimentos')
      .then(res => {
        const dados = res.data || [];
        const filtrados = dados.filter(item => {
          const nomeRaw = item && item.investidor;
          return nomeRaw && String(nomeRaw).trim() !== '';
        });
        setInvestimentos(filtrados);
      })
      .catch(err => {
        console.error('Erro ao buscar investimentos:', err);
        setInvestimentos([]);
      });
  }, []);

  // ======= Funções de imagem/avatar =======
  const salvarImagemRecortada = () => {
    if (editorRef.current && tecnicoEditor) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const dataUrl = canvas.toDataURL();
      const novaFoto = { ...fotos, [tecnicoEditor]: dataUrl };
      setFotos(novaFoto);
      localStorage.setItem('fotosTecnicos', JSON.stringify(novaFoto));
      setImagemEditor(null);
      setTecnicoEditor(null);
    }
  };

  const handleFotoUpload = (e, nome) => {
    const file = e.target.files[0];
    if (file) {
      setImagemEditor(file);
      setTecnicoEditor(nome);
    }
  };

  // ======= Serviços: adicionar / remover =======
  const adicionarServico = () => {
    const novo = {
      id: Date.now(),
      nome,
      tecnico,
      custoBase: parseFloat(custoBase) || 0,
      percentual: parseFloat(percentual) || 0,
      data: new Date().toISOString(),
    };
    setServicos(prev => [...prev, novo]);
    setNome('');
    setTecnico('');
    setCustoBase('');
    setPercentual(0);
  };

  const removerServico = (id) => {
    setServicos(prev => prev.filter(s => s.id !== id));
  };

  const agrupado = servicos.reduce((acc, servico) => {
    const nomeTec = servico.tecnico;
    if (!nomeTec) return acc;
    if (!acc[nomeTec]) acc[nomeTec] = [];
    acc[nomeTec].push(servico);
    return acc;
  }, {});

  const toggleServicos = (nomeTec) => {
    setTecnicosExpandido(prev => ({
      ...prev,
      [nomeTec]: !prev[nomeTec]
    }));
  };

  // ======= Exportar serviços para Excel =======
  const exportarParaExcel = () => {
    if (!tecnicoParaExportar) return;

    const dadosFiltrados = servicos.filter(s => s.tecnico === tecnicoParaExportar);
    let totalBonus = 0;

    const dadosParaExportar = dadosFiltrados.map(servico => {
      const base = Number(servico.custoBase) || 0;
      const perc = Number(servico.percentual) || 0;
      const bonus = base * (perc / 100);
      totalBonus += bonus;
      const valorFinal = base - bonus;
      const dataFormatada = new Date(servico.data).toLocaleDateString('pt-BR');

      return {
        'Serviço': servico.nome,
        'Técnico': servico.tecnico,
        'Custo Base': base.toFixed(2),
        'Percentual (%)': perc.toFixed(2),
        'Bônus Técnico': bonus.toFixed(2),
        'Valor Final': valorFinal.toFixed(2),
        'Data': dataFormatada
      };
    });

    dadosParaExportar.push({
      'Serviço': '',
      'Técnico': '',
      'Custo Base': '',
      'Percentual (%)': '',
      'Bônus Técnico': `TOTAL: R$ ${totalBonus.toFixed(2)}`,
      'Valor Final': '',
      'Data': ''
    });

    const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tecnicoParaExportar);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const arquivo = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(arquivo, `${tecnicoParaExportar}_servicos.xlsx`);
  };

  // ======= Investimentos: adicionar (POST) e estado =======
  const adicionarInvestimento = async () => {
    const valor = parseFloat(valorInvestido);
    const nomeFinal = mostrarOutroInvestidor ? outroInvestidor : investidor;
    if (!nomeFinal || isNaN(valor) || valor <= 0) return;

    try {
      const res = await axios.post('http://localhost:3001/api/investimentos', {
        investidor: nomeFinal,
        valor
      });
      // backend deve retornar o investimento salvo (com id e data)
      const salvo = res.data;
      // só adiciona se tiver investidor válido
      if (salvo && salvo.investidor && String(salvo.investidor).trim() !== '') {
        setInvestimentos(prev => [...prev, salvo]);
      }
      setInvestidor('');
      setOutroInvestidor('');
      setMostrarOutroInvestidor(false);
      setValorInvestido('');
    } catch (err) {
      console.error('Erro ao salvar investimento:', err);
      // fallback local se backend não responder: adicionar localmente com data
      const novoInvestimento = {
        id: Date.now(),
        investidor: nomeFinal,
        valor,
        data: new Date().toLocaleDateString('pt-BR')
      };
      setInvestimentos(prev => [...prev, novoInvestimento]);
      setInvestidor('');
      setOutroInvestidor('');
      setMostrarOutroInvestidor(false);
      setValorInvestido('');
    }
  };

  // ======= Cálculo acumulado por investidor (e dados para gráfico) =======
  // Ignoramos registros sem nome de investidor
  const totaisInvestidores = investimentos.reduce((acc, item) => {
    const nameRaw = item.investidor;
    const name = nameRaw && String(nameRaw).trim();
    if (!name) return acc; // pular entradas sem nome
    acc[name] = (acc[name] || 0) + Number(item.valor || 0);
    return acc;
  }, {});

  const dadosGraficoInvest = Object.keys(totaisInvestidores).map(nomeInv => ({
    name: nomeInv,
    value: totaisInvestidores[nomeInv]
  }));

  const cores = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

  // ======= Render =======
  return (
    <div className="p-6 min-h-screen bg-gray-100">
      {/* topo com abas */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded font-semibold ${pagina === 'servicos' ? 'bg-blue-600 text-white' : 'bg-white text-black border'}`}
          onClick={() => setPagina('servicos')}
        >
          Serviços
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold ${pagina === 'investimentos' ? 'bg-blue-600 text-white' : 'bg-white text-black border'}`}
          onClick={() => setPagina('investimentos')}
        >
          Investimentos
        </button>
      </div>

      {/* ================= INVESTIMENTOS ================= */}
      {pagina === 'investimentos' ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">Investimentos</h2>

          {/* formulário */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <select
                className="border px-4 py-2 rounded w-full"
                value={investidor}
                onChange={e => {
                  const valor = e.target.value;
                  if (valor === 'Outro') {
                    setMostrarOutroInvestidor(true);
                    setInvestidor('');
                  } else {
                    setMostrarOutroInvestidor(false);
                    setInvestidor(valor);
                  }
                }}
              >
                <option value="">Selecione o investidor</option>
                {investidoresPadrao.map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
                <option value="Outro">Outro</option>
              </select>
              {mostrarOutroInvestidor && (
                <input
                  className="border px-4 py-2 rounded w-full mt-2"
                  placeholder="Nome do novo investidor"
                  value={outroInvestidor}
                  onChange={e => setOutroInvestidor(e.target.value)}
                />
              )}
            </div>

            <input
              className="border px-4 py-2 rounded"
              placeholder="Valor investido"
              type="number"
              value={valorInvestido}
              onChange={e => setValorInvestido(e.target.value)}
            />

            <div className="md:col-span-2 flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                onClick={adicionarInvestimento}
              >
                Adicionar Investimento
              </button>
              <button
                className="bg-white text-blue-700 px-4 py-2 rounded border"
                onClick={() => {
                  // reset rápido do formulário
                  setInvestidor('');
                  setValorInvestido('');
                  setOutroInvestidor('');
                  setMostrarOutroInvestidor(false);
                }}
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Totais acumulados por investidor */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Totais Acumulados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(totaisInvestidores).length === 0 && (
                <div className="text-gray-600 col-span-full">Nenhum investimento registrado.</div>
              )}
              {Object.entries(totaisInvestidores).map(([nomeInv, total]) => (
                <div key={nomeInv} className="p-4 rounded shadow bg-blue-50">
                  <div className="font-bold text-lg">{nomeInv}</div>
                  <div>Total: R$ {Number(total).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* gráfico e histórico */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="h-64">
              {dadosGraficoInvest.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">Nenhum dado para gráfico</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={dadosGraficoInvest}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {dadosGraficoInvest.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Histórico de Investimentos</h3>
              <ul className="space-y-2 max-h-64 overflow-auto">
                {investimentos.filter(item => item && item.investidor && String(item.investidor).trim() !== '').length === 0 && (
                  <div className="text-gray-600">Nenhum registro ainda.</div>
                )}
                {investimentos
                  .filter(item => item && item.investidor && String(item.investidor).trim() !== '')
                  .map((item, index) => {
                    const dataFormat = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '';
                    return (
                      <li key={item.id ?? index} className="border p-2 rounded bg-white">
                        <div className="font-semibold">{item.investidor}</div>
                        <div>R$ {Number(item.valor).toFixed(2)}</div>
                        <div className="text-sm text-gray-500">Data: {dataFormat}</div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* ================= SERVIÇOS (mantido) ================= */
        <div>
          <div className="max-w-3xl mx-auto mb-10 bg-white p-6 rounded-lg shadow-md space-y-4">
            <select className="w-full border px-4 py-2 rounded" value={nome} onChange={e => setNome(e.target.value)}>
              <option value="">Selecione o serviço</option>
              {servicosPadrao.map(serv => (
                <option key={serv} value={serv}>{serv}</option>
              ))}
              <option value="Outro">Outro</option>
            </select>
            {nome === 'Outro' && (
              <input
                className="w-full border px-4 py-2 mt-2 rounded"
                placeholder="Digite o nome do serviço"
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            )}

            <select className="w-full border px-4 py-2 rounded" value={tecnico} onChange={e => setTecnico(e.target.value)}>
              <option value="">Selecione o técnico</option>
              {tecnicosPadrao.map(nome => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
              <option value="Outro">Outro</option>
            </select>
            {tecnico === 'Outro' && (
              <input
                className="w-full border px-4 py-2 mt-2 rounded"
                placeholder="Nome do novo técnico"
                value={tecnico}
                onChange={e => setTecnico(e.target.value)}
              />
            )}

            <input className="w-full border px-4 py-2 rounded" placeholder="Custo base" type="number" value={custoBase} onChange={e => setCustoBase(e.target.value)} />

            <div>
              <label className="block mb-1 text-gray-700">Percentual de bônus técnico (%)</label>
              <input className="w-full border px-4 py-2 rounded" type="number" value={percentual} onChange={e => setPercentual(parseFloat(e.target.value) || 0)} />
            </div>

            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={adicionarServico}>Adicionar Serviço</button>

            <div className="mt-4 flex items-center gap-4">
              <select className="border px-4 py-2 rounded" value={tecnicoParaExportar} onChange={e => setTecnicoParaExportar(e.target.value)}>
                <option value="">Escolha o técnico para exportar</option>
                {Object.keys(agrupado).map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                onClick={exportarParaExcel}
              >
                Exportar Excel
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-4">Técnicos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Object.keys(agrupado).map(tecnico => (
              <div
                key={tecnico}
                className="bg-white rounded-xl shadow-md p-4 text-center relative group cursor-pointer"
                onClick={() => toggleServicos(tecnico)}
              >
                <div className="img-wrapper mx-auto">
                  <img
                    src={fotos[tecnico] || `https://i.pravatar.cc/150?u=${tecnico}`}
                    alt={tecnico}
                    className="rounded-full w-24 h-24 mx-auto"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window[`fileInput-${tecnico}`]?.click();
                    }}
                    className="edit-btn"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-gray-800">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 00-1.42 0l-2.34 2.34 3.75 3.75 2.34-2.34a1.003 1.003 0 000-1.42z" />
                    </svg>
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleFotoUpload(e, tecnico)}
                    ref={input => input && (window[`fileInput-${tecnico}`] = input)}
                  />
                </div>
                <div className="mt-2">
                  <div className="text-lg font-bold text-indigo-700">{tecnico}</div>
                  <div className="text-gray-600">{agrupado[tecnico].length} serviço(s)</div>
                </div>
                {tecnicosExpandido[tecnico] && (
                  <div className="mt-4 text-left space-y-2 text-sm">
                    {agrupado[tecnico].map(servico => {
                      const base = Number(servico.custoBase) || 0;
                      const perc = Number(servico.percentual) || 0;
                      const bonus = base * (perc / 100);
                      const valorFinal = base - bonus;
                      const data = new Date(servico.data).toLocaleDateString('pt-BR');
                      return (
                        <div key={servico.id} className="bg-gray-50 p-2 rounded">
                          <div className="font-semibold">{servico.nome || 'Sem nome'}</div>
                          <div>Custo base: R$ {base.toFixed(2)}</div>
                          <div>Bônus técnico: R$ {bonus.toFixed(2)}</div>
                          <div>Valor final: R$ {valorFinal.toFixed(2)}</div>
                          <div>Data: {data}</div>
                          <button className="text-red-500 hover:underline text-xs mt-1" onClick={(e) => { e.stopPropagation(); removerServico(servico.id); }}>Remover</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* avatar editor modal */}
      {imagemEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <AvatarEditor
              ref={editorRef}
              image={imagemEditor}
              width={150}
              height={150}
              border={50}
              borderRadius={999}
              scale={scale}
            />
            <input
              type="range"
              min="1"
              max="2"
              step="0.01"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full mt-4"
            />
            <div className="mt-4 flex justify-center gap-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={salvarImagemRecortada}>Salvar</button>
              <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setImagemEditor(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

 
 