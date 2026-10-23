-- Provider names are not consent to a public username. Existing visibility must
-- be chosen again after the owner explicitly saves a username in Profile.
ALTER TABLE auth_user ADD COLUMN public_username TEXT;
UPDATE auction_public_profiles SET showcase_public=0,leaderboard_public=0;
CREATE TRIGGER auction_username_removed AFTER UPDATE OF public_username ON auth_user
WHEN NEW.public_username IS NULL OR trim(NEW.public_username)=''
BEGIN
 UPDATE auction_public_profiles SET showcase_public=0,leaderboard_public=0 WHERE user_id=NEW.id;
END;
