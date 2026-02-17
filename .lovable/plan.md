
# Correção: Incompatibilidade JDK 21 com Android Gradle Plugin

## Diagnóstico

O erro de `jlink` com JDK 21 é causado por uma incompatibilidade de versões conhecida:

| Componente | Versão Atual | Problema |
|---|---|---|
| Android Gradle Plugin | 8.1.4 | Projetado para JDK 17, falha com JDK 21 |
| Gradle Wrapper | 8.5 | Requer atualização para suportar AGP 8.3+ |
| `compileOptions` | `VERSION_1_8` | Desatualizado, pode causar warnings |
| `capacitor-cordova-android-plugins` | AGP 8.7.2 | Já usa versão mais nova que o projeto principal |

O arquivo `android/capacitor-cordova-android-plugins/build.gradle` já usa AGP `8.7.2`, enquanto o projeto principal usa `8.1.4` — essa inconsistência também pode gerar conflitos.

## Solução: Atualizar AGP + Gradle Wrapper

### Arquivo 1: `android/build.gradle` (build script raiz)

Atualizar o AGP de `8.1.4` para `8.7.2` (mesma versão já usada pelo plugin Cordova):
```text
// ANTES:
classpath 'com.android.tools.build:gradle:8.1.4'

// DEPOIS:
classpath 'com.android.tools.build:gradle:8.7.2'
```

### Arquivo 2: `android/gradle/wrapper/gradle-wrapper.properties`

Atualizar o Gradle Wrapper de `8.5` para `8.9` (compatível com AGP 8.7 + JDK 21):
```text
// ANTES:
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-bin.zip

// DEPOIS:
distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-bin.zip
```

### Arquivo 3: `android/app/build.gradle`

Atualizar `compileOptions` de `VERSION_1_8` para `VERSION_17` (obrigatório para AGP 8.3+):
```text
// ANTES:
compileOptions {
    sourceCompatibility JavaVersion.VERSION_1_8
    targetCompatibility JavaVersion.VERSION_1_8
}

// DEPOIS:
compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
}
```

Também atualizar `compileSdk` e `targetSdk` de `34` para `35` (recomendado para AGP 8.7+):
```text
compileSdk 35
targetSdk 35
```

### Arquivo 4: `android/gradle.properties`

Adicionar flag para suporte explícito ao JDK 21 e melhorar performance de build:
```text
# Adicionar no final:
org.gradle.java.home.auto=false
android.suppressUnsupportedCompileSdk=35
```

## Tabela de Compatibilidade (após a mudança)

| Componente | Versão Nova | Compatibilidade JDK 21 |
|---|---|---|
| Android Gradle Plugin | 8.7.2 | Suporte nativo JDK 21 |
| Gradle Wrapper | 8.9 | Compatível com AGP 8.7 |
| Java compile target | 17 | Compatível com JDK 21 |
| Kotlin | 1.9.10 | Compatível |

## Comandos após as alterações

Após o Lovable aplicar as mudanças, executar localmente:

```bash
# Sincronizar e compilar
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

Se ainda tiver o Gradle cache antigo com a versão 8.5, forçar limpeza:
```bash
cd android
./gradlew clean assembleRelease
```

## Arquivos a modificar

- `android/build.gradle` — AGP de `8.1.4` → `8.7.2`
- `android/gradle/wrapper/gradle-wrapper.properties` — Gradle de `8.5` → `8.9`
- `android/app/build.gradle` — `compileOptions` para `VERSION_17`, `compileSdk`/`targetSdk` para `35`
- `android/gradle.properties` — flags adicionais de compatibilidade JDK 21

## Notas Adicionais

- O `minSdk` continua em `22` (ou pode-se ajustar para `23` que é o padrão do Capacitor)
- Nenhuma alteração no código React ou Capacitor é necessária
- A biblioteca PayGO (`.aar`) continuará funcionando pois é compatível com Java 17+
- O Gradle Wrapper 8.9 será baixado automaticamente na primeira compilação (aprox. 130MB)
