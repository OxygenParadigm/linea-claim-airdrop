# 🚀 Linea Airdrop Claimer

<div align="center">

**Автоматизированный бот для клейма аирдропа Linea с возможностью вывода или свапа токенов**

[Установка](#установка) • [Конфигурация](#конфигурация) • [Запуск](#запуск) • [FAQ](#faq)

</div>

---

## 📋 Описание

Бот поддерживает три режима работы:

- **Только клейм** — получение токенов на кошельки
- **Клейм + Swap** — получение и обмен на ETH через Odos
- **Клейм + Вывод** — получение и перевод на указанные адреса

## 🛠 Установка

### Шаги установки

1. **Клонирование репозитория**

```bash
git clone https://github.com/your-repo/linea-claimer.git
cd linea-claimer
```

2. **Установка зависимостей**

```bash
npm install
# или
yarn install
```

## ⚙️ Конфигурация

### 📝 config/config.json

Основной файл конфигурации со всеми параметрами:

```json
{
  "mode": "claim", // claim | claim_withdraw | claim_swap
  "rpc_list": [
    "https://linea-rpc.publicnode.com",
    "https://rpc.linea.build",
    "https://1rpc.io/linea"
  ],
  "number_of_threads": 1,
  "start_delay_seconds": [3, 9],
  "claim_delay_seconds": [20, 90],
  "retries": 3,
  "shuffle_wallets": true,
  "retry_delay_seconds": 5,
  "odos_slippage": 3
}
```

#### Параметры конфигурации

| Параметр              | Тип    | Описание                                | Значения                                     |
| --------------------- | ------ | --------------------------------------- | -------------------------------------------- |
| `mode`                | string | Режим работы бота                       | `CLAIM_ONLY`, `CLAIM_SWAP`, `CLAIM_WITHDRAW` |
| `rpc_list`            | array  | Список RPC эндпоинтов                   | URL массив                                   |
| `number_of_threads`   | number | Количество параллельных потоков         | number                                       |
| `retries`             | number | Количество повторов при ошибке          | number                                       |
| `retry_delay_seconds` | number | Задержка между повторами (мс)           | number                                       |
| `start_delay_seconds` | array  | Диапазон задержки между кошельками (мс) | [min, max]                                   |
| `odos_slippage`       | number | Слиппаж для Odos (%)                    | number                                       |

### 🔑 config/wallets.txt

Файл с приватными ключами кошельков:

#### Режим CLAIM_ONLY и CLAIM_SWAP:

```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321
0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

#### Режим CLAIM_WITHDRAW:

```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:0xReceiverAddress1
0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321:0xReceiverAddress2
0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:0xReceiverAddress3
```

> ⚠️ **Важно**: В режиме `CLAIM_WITHDRAW` обязательно указывайте адрес получателя через двоеточие!

## 🚀 Запуск

### Быстрый старт

```bash
npm run build
npm start
```

### Мониторинг процесса

Бот выводит детальную информацию о процессе:

```
🔄 Processing wallet: 0x1234...abcd
✅ 0x1234...abcd: Claimed 150.5 LINEA tokens
💱 0x1234...abcd: Swapped to 0.08 ETH
📊 Progress: 45/100 wallets processed

=== Claim Process Completed ===
Total wallets processed: 100
Total Linea claimed: 15,250.75
Failed wallets: 2

Failed wallets:
- 0x5678...efgh
- 0x9abc...def0
```

<div align="center">

Made with ❤️ for Linea Community

</div>
