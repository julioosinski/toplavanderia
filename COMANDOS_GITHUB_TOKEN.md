# 🔑 COMANDOS PARA USAR O TOKEN DO GITHUB

## 📋 **INSTRUÇÕES PASSO A PASSO**

### **1. Configure o Token (Substitua SEU_TOKEN pelo token real)**

```bash
git remote set-url origin https://SEU_TOKEN@github.com/julioosinski/toplavanderia.git
```

**Exemplo:** Se seu token for `ghp_1234567890abcdef`, execute:
```bash
git remote set-url origin https://ghp_1234567890abcdef@github.com/julioosinski/toplavanderia.git
```

### **2. Verifique se foi configurado corretamente**

```bash
git remote -v
```

**Deve mostrar:**
```
origin  https://ghp_1234567890abcdef@github.com/julioosinski/toplavanderia.git (fetch)
origin  https://ghp_1234567890abcdef@github.com/julioosinski/toplavanderia.git (push)
```

### **3. Faça o Push**

```bash
git push origin main
```

### **4. Verifique no GitHub**

Acesse: https://github.com/julioosinski/toplavanderia

## ✅ **RESULTADO ESPERADO**

Após executar os comandos, você deve ver:

- ✅ **README.md** com documentação completa
- ✅ **Pasta android/** com código Android
- ✅ **Pasta src/** com código React  
- ✅ **Pasta supabase/** com backend
- ✅ **Pasta tablet_package/** com instalação
- ✅ **Arquivos de configuração**
- ✅ **Scripts de build**

## 🚨 **SE DER ERRO**

### **Erro de Token Inválido:**
- Verifique se copiou o token completo
- Verifique se tem as permissões `repo` e `workflow`

### **Erro de Conexão:**
- Verifique sua internet
- Tente novamente em alguns minutos

### **Erro de Permissão:**
- Verifique se o token tem acesso ao repositório
- Gere um novo token se necessário

## 📞 **PRECISA DE AJUDA?**

Se algo não funcionar:
1. Copie a mensagem de erro
2. Verifique se o token está correto
3. Tente gerar um novo token
4. Execute os comandos novamente

---

**🎯 Execute os comandos acima e seu projeto estará no GitHub!**
