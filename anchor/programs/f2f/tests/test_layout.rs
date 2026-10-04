//! Guards the layouts of accounts that already exist on devnet (pools 1, 2 and 5) and the
//! discriminants of enums stored in them. New variants may only be appended.
use anchor_lang::{AnchorSerialize, Space};

#[test]
fn existing_account_layouts_do_not_change() {
    assert_eq!(f2f::Config::INIT_SPACE, 161);
    assert_eq!(f2f::Pool::INIT_SPACE, 171);
    assert_eq!(f2f::FarmProject::INIT_SPACE, 126);
    assert_eq!(f2f::Field::INIT_SPACE, 75);
    assert_eq!(f2f::Attestation::INIT_SPACE, 285);
    assert_eq!(f2f::InvestorRecord::INIT_SPACE, 42);
    assert_eq!(f2f::FeeConfig::INIT_SPACE, 51);
    assert_eq!(f2f::PoolTerms::INIT_SPACE, 3);
}

fn tag<T: AnchorSerialize>(v: T) -> u8 {
    let mut out = Vec::new();
    v.serialize(&mut out).unwrap();
    out[0]
}

#[test]
fn stored_enum_discriminants_are_stable() {
    use f2f::{AttestationKind as K, PoolStatus as S, SettlementRule as R, Verdict as V};
    assert_eq!([tag(K::FieldVerified), tag(K::Sowing), tag(K::Vegetation), tag(K::Harvest)], [0, 1, 2, 3]);
    assert_eq!([tag(S::Draft), tag(S::Open), tag(S::Funded), tag(S::Refunding), tag(S::Redeeming)], [0, 1, 2, 3, 4]);
    assert_eq!([tag(R::Delivered), tag(R::CoveredFromOtherFields), tag(R::BoughtOnMarket), tag(R::CashRepaidWithPremium)], [0, 1, 2, 3]);
    assert_eq!([tag(V::Pass), tag(V::Fail), tag(V::InsufficientData)], [0, 1, 2]);
}
