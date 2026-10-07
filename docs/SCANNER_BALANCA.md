# Etiquetas de balança

O código completo de cada embalagem não é o identificador fixo da carne. Cadastre o produto uma vez, com unidade `kg`, preço por quilo e PLU da balança.

## Mercado com total impresso (opção A)

A etiqueta real `2000100019603` se divide em `20 | 00100 | 01960 | 3`: prefixo `20`, PLU `100`, total R$ 19,60 e dígito verificador `3`.

1. No painel do mercado, abra **Balança** e selecione **Preço total · prefixo 20 · PLU 5 (opção A)**.
2. Mantenha a leitura de etiquetas e a validação do dígito verificador habilitadas. Salve.
3. Em Produtos, cadastre a carne com **PLU 100**, unidade **kg** e preço **37,90**. Não use essa etiqueta inteira como o código fixo do produto.
4. Reinicie o app conectado à API para carregar a configuração salva. No simulador de Balança, cole `2000100019603` e confira o PLU e o total.
5. Ao escanear, a base da linha será **R$ 19,60**, com peso estimado de **aproximadamente 0,517 kg**. Promoções ativas podem alterar o total final. O peso exato não está codificado nessa etiqueta.

A configuração fica no PostgreSQL em `tenant_settings`: `scale_prefix=20`, `scale_plu_length=5`, `scale_value_type=price`, `scale_value_length=5`, `scale_value_decimals=2`. O preset só muda o mercado quando o lojista salva; nenhum banco remoto foi alterado por este ajuste.

A separação `20 + 00010 + 001960 + C` tem 14 dígitos e não cabe em EAN-13. Não use esse layout para a etiqueta real apresentada.

## Mercado com peso impresso (opção B)

Selecione **Peso · prefixo 2 · PLU 5 (opção B)**. Layout: `2 | XXXXX | ZZZZZZ | C`; seis dígitos em gramas, três casas decimais. `001250` representa 1,250 kg; a R$ 37,90/kg resulta em R$ 47,38.

## Erros de cadastro

Etiqueta reconhecida pelo prefixo com dígito inválido, valor zero, PLU inexistente ou produto sem unidade kg/preço válido gera uma mensagem de erro. Ela não cai na busca pelo código completo como produto comum. Outros códigos seguem a consulta normal; se a leitura de balança estiver desativada, todos seguem a consulta normal.

Validação automatizada: `npm run test:scale`. Confirme também uma etiqueta física com a câmera no mercado.
