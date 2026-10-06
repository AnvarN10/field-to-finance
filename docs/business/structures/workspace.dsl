/*
 * Field-to-Finance: структуры токенизации RWA в МФЦА.
 * Модель и представления для документа structures-aifc-f2f-ru.typ (06.10.2026).
 * Рендер: ./build.sh (Structurizr export -> PlantUML -> PNG).
 * Это рабочая модель для обсуждения, не юридическое заключение.
 */
workspace "F2F: структуры токенизации" "Участники, деньги и хранение по вариантам участия F2F Proto и Commodity Chain Ltd" {

    !identifiers flat

    model {

        # --- Люди -------------------------------------------------------------
        inv = person "Инвестор" "Розничный или профессиональный клиент: KYC, категория, KFD" "Участник"
        farmer = person "Фермер (ТОО РК)" "Юрлицо-резидент РК вне МФЦА; в пилоте эмитент по терм-шиту" "Участник"
        farmerA = person "ТОО-фермер A" "Эмитент WHEAT27-A под свои поля" "Участник"
        farmerB = person "ТОО-фермер B" "Эмитент WHEAT27-B под свои поля" "Участник"

        # --- Платформа F2F ------------------------------------------------------
        f2f = softwareSystem "Платформа F2F" "Кабинеты ролей, программа на Solana, документы по хешу" "F2F" {
            web = container "Веб-приложение" "Кабинеты ролей, сборка и спонсирование транзакций, заглушка SCAS" "Next.js, Railway" "F2F"
            prog = container "Программа f2f" "Пулы, минт Token-2022, хранилище USDC, подписка, выплата, погашение" "Anchor, Solana" "F2F,Chain"
            db = container "База данных" "Заявки, роли, решения KYC, журнал аудита; личные данные только здесь" "Postgres, Railway" "F2F,Store"
            bucket = container "Хранилище документов" "Документы и доказательства, ключ = SHA-256" "Railway bucket" "F2F,Store"
            keys = container "Серверные ключи" "Арранжировщик (Config.issuer), комплаенс, SCAS, спонсор газа" "env в пилоте, KMS в целевой" "F2F,Key"
        }

        # --- Организации ----------------------------------------------------------
        proto = softwareSystem "F2F Proto" "Компания МФЦА (регистрируется); роль зависит от варианта" "Org,F2FOrg"
        cctech = softwareSystem "CC Tech" "Бенефициар F2F Proto, владелец прав на платформу" "Org,F2FOrg"
        spv = softwareSystem "SPV или ячейка пула" "Эмитент одного выпуска, изолирует риск пула" "Org,F2FOrg"
        cc = softwareSystem "Commodity Chain Ltd" "Биржа и клиринг Investment Tokens, AFSA-A-LA-2026-0014, ждёт начала операций" "Org,CC"
        cust = softwareSystem "Кастодиан Investments" "Providing Custody на Investments: деньги и токены по клиентам" "Org,Licensed"
        broker = softwareSystem "Брокер МФЦА" "Arranging, Dealing as Agent, хранение у себя или у кастодиана" "Org,Licensed"
        cf = softwareSystem "Краудфандинговая платформа займов" "Operating a Loan Crowdfunding Platform" "Org,Licensed"
        bnkz = softwareSystem "Binance KZ" "DATF и хранение только цифровых активов; шлюз тенге и USDC" "Org,Crypto"
        swiss = softwareSystem "On-ramp партнёра по LOI" "Фиат в USDC; швейцарская компания не найдена, вероятно APS (МФЦА)" "Org,Crypto"
        payIn = softwareSystem "Банк или платёжная система инвестора" "Фиат только со своего счёта и на свой счёт" "Org,Bank"
        bankKz = softwareSystem "Банк РК" "Тенговые счета эмитента, SPV, фермера" "Org,Bank"
        bereke = softwareSystem "Bereke Bank" "Счёт CC для комиссий за размещение и погашение" "Org,Bank"
        afsa = softwareSystem "AFSA" "Регулятор МФЦА: лицензии, уведомления, надзор" "Regulator"
        scas = softwareSystem "SCAS" "Спутниковая проверка полей; провайдер не выбран, в MVP заглушка" "Org,External"
        kyc = softwareSystem "KYC-провайдер" "Проверка личности и компаний; в пилоте вручную" "Org,External"
        elev = softwareSystem "Элеватор" "Приёмка зерна в Усть-Каменогорске, складская расписка" "Org,Grain"
        lab = softwareSystem "Baltic Control" "Лаборатория: протокол качества по 12 параметрам" "Org,Grain"
        qoldau = softwareSystem "Qoldau.kz" "Реестр зерновых расписок РК" "Org,Grain"
        phantom = softwareSystem "Кошелёк инвестора" "Phantom, самохранение ключа" "External,Wallet"
        privy = softwareSystem "Privy" "Вход по email, встроенный кошелёк фермера" "External,Wallet"

        # --- Платформа: связи контейнеров ----------------------------------------
        inv -> web "Онбординг, подписка, погашение"
        inv -> phantom "Подписывает транзакции"
        web -> phantom "Транзакция на подпись"
        phantom -> web "Подписанная транзакция"
        farmer -> web "Заявка, документы, выбор расчёта"
        farmer -> privy "Вход по email, подпись"
        privy -> web "Подписанная транзакция фермера"
        web -> db "Заявки, роли, аудит"
        web -> bucket "Документы по SHA-256"
        web -> keys "Запрос подписи роли"
        keys -> prog "Операции ролей, оплата газа"
        prog -> inv "WHEAT на кошелёк, выплаты"
        prog -> farmer "Выплата USDC"
        scas -> web "Аттестации полей"
        web -> kyc "Проверка KYC и KYB"
        elev -> web "Складская расписка"
        lab -> web "Протокол качества"
        afsa -> web "Читает реестр и события"
        proto -> web "Ведёт платформу"
        prog -> proto "Комиссии в казну"

        # --- Крипто-шлюзы ----------------------------------------------------------
        inv -> bnkz "Тенге в USDC"
        bnkz -> phantom "Вывод USDC"
        inv -> swiss "Фиат в USDC"
        swiss -> phantom "USDC на кошелёк"
        farmer -> bnkz "Продажа USDC за тенге"
        bnkz -> bankKz "Вывод тенге на свой счёт"

        # --- Зерно -----------------------------------------------------------------
        farmer -> elev "Сдаёт зерно"
        lab -> elev "Протокол качества партии"
        elev -> qoldau "Регистрирует расписку"
        inv -> elev "Предъявляет Grain Claim"

        # --- Биржа CC и кастодиан ------------------------------------------------
        cc -> web "Использует технологию F2F"
        web -> cc "Заявки и данные пула"
        cc -> cust "Поручения на расчёт"
        cust -> cc "Подтверждения и сверка"
        cust -> inv "Выписки и подтверждения"
        inv -> payIn "Пополнение со своего счёта"
        payIn -> cust "Деньги на суб-счёт"
        farmer -> cc "Заявка эмитента, договор оферты"
        farmer -> bereke "Комиссии CC"
        cust -> farmer "Суб-счёт эмитента"
        cust -> bankKz "Вывод денег эмитента"
        bankKz -> farmer "Тенге на счёт"
        farmer -> bankKz "Тенге на погашение"
        bankKz -> cust "Деньги на погашение"
        inv -> cc "Заявки на покупку"
        cc -> afsa "Отчётность, уведомление об аутсорсинге"
        cc -> proto "Договор аутсорсинга"
        cctech -> proto "Владеет, передаёт права на IP"

        # --- F2F Proto как арранжировщик -------------------------------------------
        inv -> proto "Онбординг у арранжировщика"
        proto -> cc "Участник торгов, заявки клиентов"
        proto -> afsa "Отчётность, уведомления"
        proto -> cust "Открывает счета клиентов"

        # --- F2F Proto или SPV как эмитент ---------------------------------------
        prog -> spv "Выплата USDC эмитенту"
        spv -> prog "Пополняет хранилище"
        spv -> bnkz "Продаёт и покупает USDC"
        bnkz -> spv "USDC на кошелёк эмитента"
        spv -> bankKz "Платёжные поручения"
        bankKz -> bnkz "Тенге на покупку USDC"
        proto -> spv "Учреждает, управляет"
        farmer -> spv "Возврат займа или зерно"

        # --- Несколько ТОО-эмитентов ---------------------------------------------
        farmerA -> web "Заявка эмитента A"
        farmerB -> web "Заявка эмитента B"
        prog -> farmerA "Выплата пула A"
        prog -> farmerB "Выплата пула B"
        farmerA -> bnkz "Продажа USDC за тенге"
        farmerB -> bnkz "Продажа USDC за тенге"
        proto -> farmerA "Договор организации выпуска"
        proto -> farmerB "Договор организации выпуска"
        bankKz -> farmerA "Тенге на счёт ТОО A"
        bankKz -> farmerB "Тенге на счёт ТОО B"

        # --- Брокер ----------------------------------------------------------------
        inv -> broker "Счёт, KYC, деньги"
        broker -> web "Проводит подписку"
        broker -> inv "Выписки, хранение токенов"
        broker -> afsa "Отчётность"
        proto -> broker "Договор размещения"
        broker -> bankKz "Оплата эмитенту"
        broker -> cust "Хранение токенов клиентов"

        # --- Краудфандинг ----------------------------------------------------------
        inv -> cf "Обязательства в период сбора"
        cf -> farmer "Заём после сбора цели"
        farmer -> cf "Погашение займа"
        cf -> inv "Выплаты по займу"
        web -> cf "Карточка проекта, данные SCAS"
        cf -> cust "Организует хранение"
        cf -> afsa "Отчётность"

        # --- Развёртывание: пилот --------------------------------------------------
        pilot = deploymentEnvironment "Пилот" {
            deploymentNode "Браузер инвестора" "" "Chrome, расширение Phantom" {
                pilotPhantom = softwareSystemInstance phantom
            }
            deploymentNode "Privy" "" "облако Privy" {
                pilotPrivy = softwareSystemInstance privy
            }
            deploymentNode "Railway" "" "проект field-to-finance" {
                deploymentNode "Сервис web" "" "Node.js, basic auth" {
                    pilotWeb = containerInstance web
                    pilotKeys = containerInstance keys
                }
                deploymentNode "Сервис Postgres" "" "Postgres 16" {
                    pilotDb = containerInstance db
                }
                deploymentNode "Bucket" "" "S3-совместимое хранилище" {
                    pilotBucket = containerInstance bucket
                }
            }
            deploymentNode "Solana devnet" "" "публичная тестовая сеть" {
                pilotProg = containerInstance prog
                pilotUsdc = infrastructureNode "Тестовый USDC" "Минт выпущен командой, кран для демо" "SPL Token"
                pilotUpgrade = infrastructureNode "Ключ обновления программы" "У команды, один ключ" "keypair"
            }
            pilotKeys -> pilotUsdc "Кран тестового USDC"
            pilotUpgrade -> pilotProg "Обновляет код"
        }

        # --- Развёртывание: целевая схема ------------------------------------------
        target = deploymentEnvironment "Целевая" {
            deploymentNode "Railway или аналог" "" "сервисы F2F" {
                deploymentNode "Сервис web" "" "Node.js" {
                    tgtWeb = containerInstance web
                }
                deploymentNode "KMS или HSM" "" "облачный KMS" {
                    tgtKeys = containerInstance keys
                }
            }
            deploymentNode "Solana mainnet" "" "или разрешительная сеть по AMI 2-1.1.1(a)" {
                tgtProg = containerInstance prog
                tgtUsdc = infrastructureNode "USDC (Circle)" "Расчётный стейблкоин" "SPL Token"
                tgtMultisig = infrastructureNode "Мультисиг Squads" "Обновление программы и admin, 2 из 3" "Squads"
            }
            deploymentNode "Кастодиан" "" "лицензия Providing Custody" {
                tgtCust = softwareSystemInstance cust
                tgtHsm = infrastructureNode "HSM кастодиана" "Ключи кошельков клиентов" "HSM"
            }
            deploymentNode "Commodity Chain Ltd" "" "биржа и клиринг" {
                tgtCc = softwareSystemInstance cc
            }
            deploymentNode "Binance KZ" "" "DATF" {
                tgtBnkz = softwareSystemInstance bnkz
                tgtBnkzAcc = infrastructureNode "Корпоративный аккаунт эмитента" "Доступ у подписантов эмитента; вывод только на свои счета" "аккаунт DATF"
            }
            deploymentNode "Банк РК" "" "тенговые счета" {
                tgtBank = softwareSystemInstance bankKz
                tgtBankSig = infrastructureNode "ЭЦП подписантов" "Платёжные поручения эмитента или SPV" "интернет-банк"
            }
            tgtMultisig -> tgtProg "Обновляет код, меняет ключи ролей"
            tgtHsm -> tgtProg "Подписывает от имени клиентов"
            tgtProg -> tgtUsdc "Переводы USDC"
        }
    }

    views {

        # ====================== Общие ======================
        systemContext f2f "f2f-context" "Платформа F2F и её окружение в пилоте" {
            include f2f inv farmer proto scas kyc elev lab afsa phantom privy
            exclude "inv -> proto" "proto -> afsa" "lab -> elev" "inv -> elev" "inv -> phantom" "farmer -> privy"
            autolayout tb 200 100
        }

        container f2f "f2f-containers" "Контейнеры платформы F2F" {
            include *
            exclude cc spv farmerA farmerB broker cf elev lab qoldau proto afsa
            autolayout tb 200 100
        }

        deployment f2f pilot "deploy-pilot" "Пилот: Railway и Solana devnet, кто держит ключи" {
            include *
            autolayout tb 200 100
        }

        deployment * target "deploy-target" "Целевая схема: mainnet, кастодиан, биржа, банк" {
            include *
            exclude "tgtBnkz -> tgtBank" "tgtBank -> tgtBnkz" "tgtCust -> tgtBank" "tgtBank -> tgtCust" "tgtCust -> tgtCc" "tgtCc -> tgtWeb"
            autolayout lr 200 80
        }

        dynamic f2f "flow-onboarding" "Онбординг инвестора и фермера (MVP)" {
            inv -> web "Вход по email (Privy), роль «инвестор»"
            web -> db "Профиль, категория, лимиты розницы"
            inv -> web "Анкета KYC, документы"
            web -> bucket "Документы по SHA-256"
            web -> kyc "Проверка (в пилоте вручную, решает комплаенс)"
            web -> keys "Комплаенс одобрил: approve_investor"
            keys -> prog "InvestorRecord = approved для всех пулов"
            farmer -> web "Заявка эмитента, документы по требованиям терм-шита"
            web -> db "Статус: submitted, documents_review, kyc"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic f2f "flow-issuance" "Выпуск: проверка полей, пул, условия, открытие" {
            farmer -> web "Поля и данные землепользования (вне блокчейна)"
            web -> db "Набор полей, кадастровые данные"
            scas -> web "Проверка полей (сейчас заглушка)"
            web -> bucket "Доказательство по SHA-256"
            web -> keys "record_attestation (ключ SCAS)"
            keys -> prog "Аттестация FieldVerified"
            web -> keys "create_pool и set_instrument_terms"
            keys -> prog "Пул, минт Token-2022, InstrumentTerms"
            web -> keys "open_pool после публикации KFD"
            keys -> prog "Пул открыт для подписки"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic f2f "flow-purchase" "Покупка: атомарная подписка за USDC" {
            inv -> web "Выбирает пул, принимает KFD"
            web -> db "kfd_acceptances с SHA-256 документа"
            web -> phantom "Транзакция subscribe на подпись"
            inv -> phantom "Подписывает"
            phantom -> web "Подписанная транзакция"
            web -> keys "Проверка состава, подпись спонсора"
            keys -> prog "subscribe: USDC в хранилище, fee в казну"
            prog -> inv "WHEAT на кошелёк, счёт разморожен"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "flow-payout-kzt" "Выплата фермеру в тенге через Binance KZ (фермер — эмитент)" {
            f2f -> farmer "disburse: USDC минус комиссия за организацию"
            farmer -> bnkz "Продаёт USDC за тенге с корпоративного счёта"
            bnkz -> bankKz "Вывод тенге только на свой счёт"
            bankKz -> farmer "Тенге на расчётный счёт ТОО"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic f2f "flow-buyback" "Погашение выкупом: номинал плюс купон Act/360" {
            farmer -> privy "elect_settlement(Buyback)"
            privy -> web "Подписанная транзакция"
            web -> keys "Подпись спонсора"
            keys -> prog "Выбор расчёта зафиксирован"
            farmer -> privy "fund_redemption: номинал плюс купон"
            privy -> web "Подписанная транзакция"
            web -> keys "Подпись спонсора"
            keys -> prog "USDC в хранилище, пул Redeeming"
            inv -> phantom "redeem"
            phantom -> web "Подписанная транзакция"
            web -> keys "Подпись спонсора"
            keys -> prog "Сжечь WHEAT, выплатить из хранилища"
            prog -> inv "Номинал плюс купон в USDC"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "flow-delivery" "Поставка зерна: расписка, протокол, Grain Claim" {
            farmer -> elev "Сдаёт зерно"
            lab -> elev "Протокол качества по 12 параметрам"
            elev -> qoldau "Зерновая расписка в реестре"
            elev -> f2f "Расписка в кабинете элеватора"
            lab -> f2f "Протокол в кабинете лаборатории"
            inv -> f2f "redeem_delivery: сжечь WHEAT"
            f2f -> inv "Событие GrainClaim: кг, хеш расписки"
            inv -> elev "Получает зерно по расписке (вне блокчейна)"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        # ====================== Вариант 1 ======================
        systemLandscape "v1-context" "Вариант 1: F2F Proto — технологический подрядчик CC" {
            include farmer inv cc proto cctech f2f cust payIn bereke bankKz afsa
            exclude "inv -> proto" "proto -> cc" "proto -> cust" "proto -> afsa" "afsa -> f2f" "inv -> cc" "f2f -> farmer" "f2f -> inv" "farmer -> f2f" "f2f -> proto"
            autolayout tb 200 100
        }

        dynamic * "v1-flow" "Вариант 1: покупка по схеме CC (две ноги «всё или ничего»)" {
            farmer -> cc "Заявка эмитента, договор оферты"
            farmer -> bereke "Комиссия за размещение на счёт CC"
            inv -> payIn "Пополняет со своего счёта"
            payIn -> cust "Деньги на суб-счёт инвестора"
            inv -> f2f "Заявка в интерфейсе CC (технология F2F)"
            f2f -> cc "Заявка в книгу CC"
            cc -> cust "Поручение: токен инвестору, деньги эмитенту"
            cust -> cc "Подтверждение и сверка"
            cust -> inv "Выписка"
            cust -> bankKz "Вывод денег эмитента"
            bankKz -> farmer "Тенге на счёт"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v1-money" "Вариант 1: где деньги и токены" {
            inv -> payIn "деньги: фиат со своего счёта"
            payIn -> cust "деньги: суб-счёт инвестора"
            cust -> farmer "деньги: суб-счёт эмитента; токен: суб-счёт инвестора"
            cust -> bankKz "деньги: вывод эмитенту"
            bankKz -> farmer "деньги: тенге"
            farmer -> bereke "деньги: комиссии CC"
            cc -> cust "поручения, денег CC не держит"
            cc -> proto "оплата за технологию"
            autolayout tb 200 100
        }

        # ====================== Вариант 2 ======================
        systemLandscape "v2-context" "Вариант 2: F2F Proto — лицензированный арранжировщик" {
            include farmer inv cc proto f2f cust payIn bankKz afsa bereke
            exclude "cc -> proto" "afsa -> f2f" "inv -> cc" "cc -> f2f" "f2f -> cc" "f2f -> inv" "f2f -> farmer" "f2f -> proto" "farmer -> f2f"
            autolayout tb 200 100
        }

        dynamic * "v2-flow" "Вариант 2: онбординг у F2F Proto, сделка на CC" {
            farmer -> cc "Допуск выпуска, договор оферты"
            inv -> proto "KYC, категория, KFD, договор клиента"
            proto -> cust "Открывает счёт клиента (Arranging Custody)"
            inv -> payIn "Пополняет со своего счёта"
            payIn -> cust "Деньги на счёт клиента"
            proto -> cc "Заявка клиента на первичном рынке"
            cc -> cust "Поручение DvP"
            cust -> cc "Подтверждение"
            cust -> inv "Токен и выписка"
            cust -> bankKz "Деньги эмитенту"
            bankKz -> farmer "Тенге на счёт"
            proto -> afsa "Отчёт об освобождённой оферте за 30 дней"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v2-money" "Вариант 2: где деньги и токены" {
            inv -> payIn "деньги: фиат со своего счёта"
            payIn -> cust "деньги и токены: счёт клиента у кастодиана"
            proto -> cust "поручения клиента, активов не держит"
            cc -> cust "расчёт DvP"
            cust -> bankKz "деньги: эмитенту"
            bankKz -> farmer "деньги: тенге"
            farmer -> bereke "деньги: комиссии CC"
            autolayout tb 200 100
        }

        # ====================== Вариант 3 ======================
        systemLandscape "v3-context" "Вариант 3: F2F Proto или SPV — эмитент" {
            include farmer inv proto spv f2f bnkz bankKz afsa swiss
            exclude "farmer -> bnkz" "afsa -> f2f" "inv -> proto" "f2f -> farmer" "farmer -> f2f"
            autolayout tb 200 100
        }

        dynamic * "v3-flow" "Вариант 3: USDC от инвесторов, тенге фермеру" {
            inv -> bnkz "Покупает USDC за тенге"
            bnkz -> phantom "Вывод USDC на свой кошелёк"
            phantom -> f2f "Подписка: USDC в хранилище пула"
            f2f -> inv "WHEAT на кошелёк"
            f2f -> spv "Выплата USDC после сбора"
            spv -> bnkz "Продаёт USDC за тенге"
            bnkz -> bankKz "Тенге на счёт SPV"
            spv -> bankKz "Платёжное поручение"
            bankKz -> farmer "Заём или аванс за зерно в тенге"
            farmer -> spv "Возврат тенге или поставка зерна"
            spv -> f2f "Пополняет хранилище USDC"
            f2f -> inv "Номинал плюс купон"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v3-money" "Вариант 3: где деньги и токены" {
            inv -> bnkz "деньги: тенге в USDC"
            inv -> f2f "деньги: USDC в хранилище пула (PDA)"
            f2f -> inv "токен: кошелёк инвестора"
            f2f -> spv "деньги: USDC эмитенту"
            spv -> bnkz "деньги: USDC в тенге"
            bnkz -> bankKz "деньги: тенге на счёт SPV"
            bankKz -> farmer "деньги: заём или аванс"
            farmer -> spv "риск невозврата у SPV"
            autolayout tb 200 100
        }

        # ====================== Вариант 4 ======================
        systemLandscape "v4-context" "Вариант 4: каждое ТОО — эмитент своего токена" {
            include farmerA farmerB inv proto f2f bnkz bankKz cc
            exclude "cc -> proto" "inv -> proto" "proto -> cc" "inv -> cc" "inv -> bnkz" "bankKz -> bnkz"
            autolayout tb 200 100
        }

        dynamic * "v4-flow" "Вариант 4: отдельный пул на каждое ТОО" {
            proto -> farmerA "Договор организации выпуска A"
            proto -> farmerB "Договор организации выпуска B"
            farmerA -> f2f "Пул A: минт WHEAT27-A, хранилище A"
            farmerB -> f2f "Пул B: минт WHEAT27-B, хранилище B"
            inv -> f2f "Подписка на A и (или) B"
            f2f -> farmerA "Выплата пула A на кошелёк ТОО A"
            f2f -> farmerB "Выплата пула B на кошелёк ТОО B"
            farmerA -> bnkz "Продажа USDC за тенге"
            farmerB -> bnkz "Продажа USDC за тенге"
            bnkz -> bankKz "Вывод тенге на счета ТОО"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v4-money" "Вариант 4: деньги идут мимо баланса F2F" {
            inv -> f2f "деньги: USDC в хранилища A и B"
            f2f -> inv "токены: WHEAT27-A, WHEAT27-B"
            f2f -> farmerA "деньги: пул A"
            f2f -> farmerB "деньги: пул B"
            farmerA -> bnkz "деньги: USDC в тенге"
            farmerB -> bnkz "деньги: USDC в тенге"
            bnkz -> bankKz "деньги: тенге"
            bankKz -> farmerA "тенге ТОО A"
            bankKz -> farmerB "тенге ТОО B"
            f2f -> proto "комиссии за организацию"
            autolayout tb 200 100
        }

        # ====================== Вариант 5 ======================
        systemLandscape "v5-context" "Вариант 5: без CC, через брокера МФЦА" {
            include farmer inv proto f2f broker cust bankKz afsa
            exclude "inv -> proto" "proto -> cust" "afsa -> f2f" "inv -> f2f" "f2f -> inv" "cust -> farmer" "cust -> bankKz" "bankKz -> cust" "f2f -> farmer"
            autolayout tb 200 100
        }

        dynamic * "v5-flow" "Вариант 5: брокер ведёт клиента и расчёт" {
            proto -> broker "Договор размещения, документ раскрытия"
            inv -> broker "Счёт, KYC, категория, деньги"
            broker -> f2f "Подписка с омнибус-кошелька брокера"
            broker -> cust "Токены клиентов на хранение"
            broker -> bankKz "Оплата эмитенту фиатом"
            bankKz -> farmer "Тенге на счёт"
            broker -> inv "Выписка"
            broker -> afsa "Отчёт об оферте вместе с эмитентом"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v5-money" "Вариант 5: где деньги и токены" {
            inv -> broker "деньги: клиентский счёт брокера"
            broker -> cust "токены: омнибус у брокера или кастодиана"
            broker -> f2f "запись выпуска в программе"
            broker -> bankKz "деньги: эмитенту"
            bankKz -> farmer "деньги: тенге"
            autolayout tb 200 100
        }

        # ====================== Вариант 6 ======================
        systemLandscape "v6-context" "Вариант 6: краудфандинговая платформа займов" {
            include farmer inv f2f cf cust afsa proto
            exclude "inv -> f2f" "f2f -> inv" "afsa -> f2f" "inv -> proto" "proto -> cust" "cust -> farmer" "cust -> inv" "f2f -> proto" "f2f -> farmer"
            autolayout tb 200 100
        }

        dynamic * "v6-flow" "Вариант 6: заём ТОО через платформу" {
            farmer -> f2f "Проект, поля, проверка SCAS"
            f2f -> cf "Карточка проекта и данные"
            inv -> cf "Обязательства в период сбора"
            cf -> farmer "Заём после цели и 48 часов охлаждения"
            farmer -> cf "Погашение"
            cf -> inv "Выплаты"
            cf -> afsa "Отчётность платформы"
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic * "v6-money" "Вариант 6: где деньги и требования" {
            inv -> cf "деньги: счёт клиентских денег платформы"
            cf -> cust "требования: хранение организует платформа"
            cf -> farmer "деньги: заём"
            farmer -> cf "деньги: погашение"
            cf -> inv "деньги: выплаты"
            autolayout tb 200 100
        }

        # ====================== Вариант 7 ======================
        systemLandscape "v7-context" "Вариант 7: пилот «крипта на обоих концах»" {
            include farmer inv f2f proto phantom privy bnkz swiss bankKz scas elev lab
            exclude "inv -> f2f" "inv -> proto" "farmer -> bankKz" "bankKz -> bnkz" "lab -> elev"
            autolayout tb 200 100
        }

        dynamic * "v7-money" "Вариант 7: деньги и токены в пилоте" {
            inv -> swiss "деньги: фиат в USDC"
            swiss -> phantom "деньги: USDC на свой кошелёк"
            inv -> bnkz "деньги: тенге в USDC"
            bnkz -> phantom "деньги: USDC на свой кошелёк"
            phantom -> f2f "деньги: USDC в хранилище пула"
            f2f -> farmer "деньги: USDC на Privy-кошелёк"
            f2f -> proto "комиссии в казну"
            farmer -> bnkz "деньги: USDC в тенге (по желанию)"
            bnkz -> bankKz "деньги: тенге"
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
