## Gerador - SQL para Estados e Cidades

Script criado com o propósito de ler um csv, e identificar na base de dados quais registros devem ser inseridos e atualizados.

### Como funciona?

1. Crie um arquivo `.env` e preencha os campos

```
HOST="seu-host.com"
USERNAME="username-do-db"
PASSWORD="senha-do-db"
DATABASE="database"
PORT=3360
CSV_FILE_PATH="./src/input.csv"
RESULT_FILE_PATH="./src/results.tmp"
SQL_FILE_PATH="./src/results.sql"
COUNTRY_INITIAL="BR"
```

2. **CSV_FILE_PATH:** caminho para o arquivo csv contendo os estados e cidades desejados
3. **RESULT_FILE_PATH:** arquivo temporário ilustrativo do que está sendo feito
4. **SQL_FILE_PATH:** arquivo .sql com as queries
5. Entre na raiz do projeto e execute: `yarn install`
6. Após a instalação das dependências, execute: `yarn start`

### Limitações

1. O cabeçalho esperado do CSV é:

Estado,Capital,Provincias,Cidade

2. O script atua apenas em cima do **Estado** e **Cidade**


### Importante!!

- Caso o nome de algum item na tabela tenha sido alterado para um valor maior do que o original, o script não irá identificar esse registro, e ele aparecerá como se fosse para ser adicionado, por exemplo: 

Possuo um registro na tabela de cidade com o nome: **Cidade 1**

No meu CSV eu alterei o nome para: **Cidade 1 Longo**

Na consulta, este item estará nos itens a serem adicionados.

Até esse problema ser resolvido, você terá de verificar no `results.json` na propriedade `citiesToAdd` se os registros corretos estão para serem adicionados.

- Também há um problema caso os nomes das cidades sejam parecidos, por exemplo:

1. Possuo uma cidade no banco de dados chamada `Villa Sacabamba`
2. E no meu CSV eu desejo atualizar esse registro para `Sacabamba`
3. Mas no meu CSV eu também desejo inserir uma cidade chamada `Sacaba`
4. Ao gerar o script, ele vai encarar os dois registros como um, ou seja, ele vai gerar um update de `Villa Sacabamba` para `Sacabamba`, e vai gerar outro updade de `Sacabamba` para `Sacaba`


## Diff de cidades

Script criado com o propósito de ler um csv, e identificar na base de dados se todas as cidades estão presentes no arquivo.

### Como funciona?

1. Crie um arquivo `.env` e preencha os campos

```
HOST="seu-host.com"
USERNAME="username-do-db"
PASSWORD="senha-do-db"
DATABASE="database"
PORT=3360
CSV_FILE_PATH="./src/input.csv"
RESULT_FILE_PATH="./src/results.tmp"
SQL_FILE_PATH="./src/results.sql"
COUNTRY_INITIAL="BR"
```

1. **CSV_FILE_PATH:** caminho para o arquivo csv contendo os estados e cidades desejados
2. **RESULT_FILE_PATH:** arquivo temporário ilustrativo do que está sendo feito
3. Entre na raiz do projeto e execute: `yarn install`
4. Após a instalação das dependências, execute: `yarn run cities:diff`

### Limitações

1. O cabeçalho esperado do CSV é:

Estado,Capital,Provincias,Cidade

2. O script atua apenas em cima do **Estado** e **Cidade**

3. É necessário fornecer os estados e as cidades
