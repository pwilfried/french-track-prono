-- « Complète ton profil » on the home (#540): « Plus tard » hides the card for 30 days, for the
-- player on every device. The date lives with the player's private details (own rows only).
alter table player_details add column reminder_hidden_until timestamptz;
