/*
 * Вариант 2 в обезличенном виде: компания с лицензией Arranging Deals ведёт инвесторов,
 * биржа CC и платформа токенизации показаны одним блоком. 06.10.2026.
 */
workspace "Вариант 2, обезличенно" "Arranging Deals Company + биржа и платформа" {

    !identifiers flat

    model {
        inv = person "Инвестор" "Розничный или профессиональный клиент" "Участник"
        farmer = person "Фермер (ТОО РК)" "Эмитент токена под свои поля" "Участник"

        adc = softwareSystem "Arranging Deals Company" "Лицензия МФЦА: Arranging Deals, Dealing as Agent, Arranging Custody. Ведёт клиентов: KYC, категория, KFD" "Org,F2FOrg"
        exch = softwareSystem "Commodity Chain Ltd: биржа, клиринг и платформа токенизации" "Допуск выпусков, торги, расчёт DvP; программа на Solana, кабинеты ролей, документы по хешу" "Org,CC"
        cust = softwareSystem "Кастодиан Investments" "Providing Custody: деньги и токены по каждому клиенту" "Org,Licensed"
        payIn = softwareSystem "Банк или платёжная система инвестора" "Фиат только со своего счёта и на свой счёт" "Org,Bank"
        bankKz = softwareSystem "Банк РК" "Тенговый счёт эмитента" "Org,Bank"
        bereke = softwareSystem "Bereke Bank" "Счёт CC для комиссий" "Org,Bank"
        afsa = softwareSystem "AFSA" "Регулятор МФЦА" "Regulator"

        farmer -> exch "Заявка на выпуск, договор оферты, документы"
        inv -> adc "Онбординг: KYC, категория, KFD"
        adc -> exch "Заявки клиентов как участник торгов"
        adc -> cust "Открывает счета клиентов"
        inv -> payIn "Пополнение со своего счёта"
        payIn -> cust "Деньги на счёт клиента"
        exch -> cust "Поручения на расчёт DvP"
        cust -> exch "Подтверждения и сверка"
        cust -> inv "Токен и выписки"
        cust -> bankKz "Деньги эмитенту"
        bankKz -> farmer "Тенге на счёт"
        farmer -> bankKz "Тенге на погашение"
        bankKz -> cust "Деньги на погашение"
        farmer -> bereke "Комиссии за размещение и погашение"
        exch -> afsa "Отчётность биржи"
        adc -> afsa "Отчётность, отчёт об оферте"
    }

    views {
        systemLandscape "v2-generic-context" "Вариант 2: Arranging Deals Company и биржа с платформой" {
            include *
            autolayout tb 200 100
        }

        styles {
            element "Element" {
                width 320
                color #1f2933
                stroke #52606d
                fontSize 22
            }
            element "Person" {
                shape Person
                background #dbe7f3
            }
            element "F2F" {
                background #cfe8d5
                stroke #2f7d4a
            }
            element "F2FOrg" {
                background #e3f2e6
                stroke #2f7d4a
            }
            element "CC" {
                background #fde7c8
                stroke #b7791f
            }
            element "Licensed" {
                background #fff4d6
                stroke #b7791f
            }
            element "Crypto" {
                background #ece4f7
                stroke #6b46c1
            }
            element "Bank" {
                background #e2e8f0
                stroke #4a5568
            }
            element "Regulator" {
                background #fbd5d5
                stroke #c53030
            }
            element "Grain" {
                background #f3ead8
                stroke #8a6d3b
            }
            element "External" {
                background #f1f3f5
            }
            element "Wallet" {
                background #ece4f7
                stroke #6b46c1
            }
            element "Store" {
                shape Cylinder
            }
            element "Chain" {
                shape Hexagon
            }
            element "Key" {
                shape Folder
            }
            relationship "Relationship" {
                fontSize 20
                color #3e4c59
            }
        }
    }
}
