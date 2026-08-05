-- Group pictures: an owner-set photo for the whole circle, distinct from
-- the per-member circle photo already on "FamilyMember"."photoUrl".
-- Nullable: circles without a picture fall back to the initial + theme
-- colour treatment in the app and the widget.
ALTER TABLE "FamilyCircle" ADD COLUMN "photoUrl" TEXT;
