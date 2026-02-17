package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.text.DecimalFormat;

public class PDVManager {
    private static final String TAG = "PDVManager";
    
    private Context context;
    private List<Produto> produtos;
    private List<Venda> vendas;
    private Venda vendaAtual;
    private double totalCaixa;
    private int numeroVenda;
    
    public PDVManager(Context context) {
        this.context = context;
        this.produtos = new ArrayList<>();
        this.vendas = new ArrayList<>();
        this.vendaAtual = null;
        this.totalCaixa = 0.0;
        this.numeroVenda = 1;
        inicializarProdutos();
    }
    
    private void inicializarProdutos() {
        // Serviços da lavanderia para totem
        produtos.add(new Produto("LAV001", "🧺 LAVAGEM SIMPLES", 15.00, "Lavagem básica de roupas - Máquina 1"));
        produtos.add(new Produto("SEC001", "🌪️ SECAGEM SIMPLES", 10.00, "Secagem básica - Máquina 2"));
        produtos.add(new Produto("COM001", "🔄 SERVIÇO COMPLETO", 25.00, "Lavagem + Secagem - Máquina 3"));
        produtos.add(new Produto("LAV002", "🧺 LAVAGEM ESPECIAL", 20.00, "Lavagem com produtos especiais - Máquina 1"));
        produtos.add(new Produto("SEC002", "🌪️ SECAGEM ESPECIAL", 15.00, "Secagem com cuidados especiais - Máquina 2"));
        produtos.add(new Produto("PAS001", "👔 PASSAR ROUPAS", 8.00, "Passar roupas - Máquina 3"));
    }
    
    public List<Produto> getProdutos() {
        return produtos;
    }
    
    public Produto getProdutoPorCodigo(String codigo) {
        for (Produto produto : produtos) {
            if (produto.getCodigo().equals(codigo)) {
                return produto;
            }
        }
        return null;
    }
    
    public void iniciarNovaVenda() {
        vendaAtual = new Venda(numeroVenda++, new Date());
        Log.d(TAG, "Nova venda iniciada: " + vendaAtual.getNumero());
    }
    
    public void adicionarItem(Produto produto, int quantidade) {
        if (vendaAtual == null) {
            iniciarNovaVenda();
        }
        
        ItemVenda item = new ItemVenda(produto, quantidade);
        vendaAtual.adicionarItem(item);
        Log.d(TAG, "Item adicionado: " + produto.getNome() + " x" + quantidade);
    }
    
    public void removerItem(int posicao) {
        if (vendaAtual != null && posicao >= 0 && posicao < vendaAtual.getItens().size()) {
            vendaAtual.removerItem(posicao);
            Log.d(TAG, "Item removido da posição: " + posicao);
        }
    }
    
    public Venda getVendaAtual() {
        return vendaAtual;
    }
    
    public double getTotalVendaAtual() {
        return vendaAtual != null ? vendaAtual.getTotal() : 0.0;
    }
    
    public void finalizarVenda() {
        if (vendaAtual != null) {
            vendas.add(vendaAtual);
            totalCaixa += vendaAtual.getTotal();
            Log.d(TAG, "Venda finalizada: " + vendaAtual.getNumero() + " - Total: R$ " + vendaAtual.getTotal());
            vendaAtual = null;
        }
    }
    
    public void cancelarVenda() {
        if (vendaAtual != null) {
            Log.d(TAG, "Venda cancelada: " + vendaAtual.getNumero());
            vendaAtual = null;
        }
    }
    
    public List<Venda> getVendas() {
        return vendas;
    }
    
    public double getTotalCaixa() {
        return totalCaixa;
    }
    
    public int getTotalVendas() {
        return vendas.size();
    }
    
    public String getRelatorioVendas() {
        StringBuilder relatorio = new StringBuilder();
        relatorio.append("=== RELATÓRIO DE VENDAS ===\n\n");
        relatorio.append("Total de Vendas: ").append(getTotalVendas()).append("\n");
        relatorio.append("Total do Caixa: R$ ").append(new DecimalFormat("0.00").format(getTotalCaixa())).append("\n\n");
        
        SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy HH:mm");
        for (Venda venda : vendas) {
            relatorio.append("Venda #").append(venda.getNumero()).append(" - ");
            relatorio.append(sdf.format(venda.getData())).append("\n");
            relatorio.append("Total: R$ ").append(new DecimalFormat("0.00").format(venda.getTotal())).append("\n");
            relatorio.append("Itens: ").append(venda.getItens().size()).append("\n\n");
        }
        
        return relatorio.toString();
    }
    
    public void limparCaixa() {
        totalCaixa = 0.0;
        vendas.clear();
        Log.d(TAG, "Caixa limpo");
    }
    
    // Métodos para totem de autoatendimento
    public void processarServicoImediato(Produto servico) {
        // Criar venda imediata
        iniciarNovaVenda();
        adicionarItem(servico, 1);
        Log.d(TAG, "Serviço selecionado para pagamento imediato: " + servico.getNome());
    }
    
    public Venda getVendaImediata() {
        return vendaAtual;
    }
    
    public void finalizarVendaImediata() {
        if (vendaAtual != null) {
            vendaAtual.setStatus("PAGO");
            finalizarVenda();
            Log.d(TAG, "Venda imediata finalizada: " + vendaAtual.getNumero());
        }
    }
    
    public void cancelarVendaImediata() {
        if (vendaAtual != null) {
            vendaAtual.setStatus("CANCELADO");
            cancelarVenda();
            Log.d(TAG, "Venda imediata cancelada");
        }
    }
    
    // Classe interna para Produto
    public static class Produto {
        private String codigo;
        private String nome;
        private double preco;
        private String descricao;
        
        public Produto(String codigo, String nome, double preco, String descricao) {
            this.codigo = codigo;
            this.nome = nome;
            this.preco = preco;
            this.descricao = descricao;
        }
        
        public String getCodigo() { return codigo; }
        public String getNome() { return nome; }
        public double getPreco() { return preco; }
        public String getDescricao() { return descricao; }
        
        @Override
        public String toString() {
            return nome + " - R$ " + new DecimalFormat("0.00").format(preco);
        }
    }
    
    // Classe interna para ItemVenda
    public static class ItemVenda {
        private Produto produto;
        private int quantidade;
        private double subtotal;
        
        public ItemVenda(Produto produto, int quantidade) {
            this.produto = produto;
            this.quantidade = quantidade;
            this.subtotal = produto.getPreco() * quantidade;
        }
        
        public Produto getProduto() { return produto; }
        public int getQuantidade() { return quantidade; }
        public double getSubtotal() { return subtotal; }
        
        public void setQuantidade(int quantidade) {
            this.quantidade = quantidade;
            this.subtotal = produto.getPreco() * quantidade;
        }
    }
    
    // Classe interna para Venda
    public static class Venda {
        private int numero;
        private Date data;
        private List<ItemVenda> itens;
        private double total;
        private String status;
        
        public Venda(int numero, Date data) {
            this.numero = numero;
            this.data = data;
            this.itens = new ArrayList<>();
            this.total = 0.0;
            this.status = "ABERTA";
        }
        
        public void adicionarItem(ItemVenda item) {
            itens.add(item);
            calcularTotal();
        }
        
        public void removerItem(int posicao) {
            if (posicao >= 0 && posicao < itens.size()) {
                itens.remove(posicao);
                calcularTotal();
            }
        }
        
        private void calcularTotal() {
            total = 0.0;
            for (ItemVenda item : itens) {
                total += item.getSubtotal();
            }
        }
        
        public int getNumero() { return numero; }
        public Date getData() { return data; }
        public List<ItemVenda> getItens() { return itens; }
        public double getTotal() { return total; }
        public String getStatus() { return status; }
        
        public void setStatus(String status) {
            this.status = status;
        }
    }
}
