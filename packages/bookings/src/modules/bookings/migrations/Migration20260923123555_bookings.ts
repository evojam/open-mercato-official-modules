import { Migration } from '@mikro-orm/migrations';

export class Migration20260923123555_bookings extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "bookings_holidays" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "holiday_on" date not null, "label" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create unique index "bookings_holidays_org_date_uq" on "bookings_holidays" ("organization_id", "tenant_id", "holiday_on") where "deleted_at" is null;`);

    this.addSql(`create table "bookings_settings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "free_on_monday" boolean not null default false, "free_on_tuesday" boolean not null default false, "free_on_wednesday" boolean not null default false, "free_on_thursday" boolean not null default false, "free_on_friday" boolean not null default false, "free_on_saturday" boolean not null default true, "free_on_sunday" boolean not null default true, "warning_threshold_working_days" int not null default 5, "time_zone" text not null default 'UTC', "conflict_policy" text not null default 'advisory', "last_scan_local_date" date null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "bookings_settings" add constraint "bookings_settings_org_tenant_uq" unique ("organization_id", "tenant_id");`);
    this.addSql(`alter table "bookings_settings" add constraint "bookings_settings_warning_threshold_chk" check ("warning_threshold_working_days" >= 0);`);
    this.addSql(`alter table "bookings_settings" add constraint "bookings_settings_conflict_policy_check" check ("conflict_policy" in ('advisory', 'reject'));`);

    this.addSql(`create table "bookings_subject_categories" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "icon" text null, "color" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create unique index "bookings_subject_categories_org_name_uq" on "bookings_subject_categories" ("organization_id", "tenant_id", lower("name")) where "deleted_at" is null;`);
    this.addSql(`create index "bookings_subject_categories_org_tenant_deleted_idx" on "bookings_subject_categories" ("organization_id", "tenant_id", "deleted_at");`);

    this.addSql(`create table "bookings_subjects" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "category_id" uuid null, "provider_key" text not null, "provider_record_id" text not null, "name" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create unique index "bookings_subjects_provider_record_uq" on "bookings_subjects" ("organization_id", "tenant_id", "provider_key", "provider_record_id") where "deleted_at" is null;`);
    this.addSql(`create index "bookings_subjects_category_idx" on "bookings_subjects" ("category_id");`);
    this.addSql(`create index "bookings_subjects_org_tenant_deleted_idx" on "bookings_subjects" ("organization_id", "tenant_id", "deleted_at");`);

    this.addSql(`create table "bookings_conflict_policy_exceptions" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "category_id" uuid not null, "mode" text not null default 'reject', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create unique index "bookings_conflict_policy_exceptions_category_uq" on "bookings_conflict_policy_exceptions" ("organization_id", "tenant_id", "category_id") where "deleted_at" is null;`);
    this.addSql(`create index "bookings_conflict_policy_exceptions_org_tenant_deleted_idx" on "bookings_conflict_policy_exceptions" ("organization_id", "tenant_id", "deleted_at");`);
    this.addSql(`alter table "bookings_conflict_policy_exceptions" add constraint "bookings_conflict_policy_exceptions_mode_check" check ("mode" in ('advisory', 'reject'));`);

    this.addSql(`create table "bookings_targets" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "bookings_targets_org_name_idx" on "bookings_targets" ("organization_id", "name");`);
    this.addSql(`create index "bookings_targets_org_tenant_deleted_idx" on "bookings_targets" ("organization_id", "tenant_id", "deleted_at");`);

    this.addSql(`create table "bookings_bookings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "target_id" uuid not null, "start_at" timestamptz null, "end_at" timestamptz null, "status" text not null default 'planned', "duration_value" numeric(8,2) not null, "duration_unit" text not null default 'working_days', "expected_start_on" date not null, "last_warned_working_days" int null, "note" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "bookings_bookings_target_idx" on "bookings_bookings" ("target_id");`);
    this.addSql(`create index "bookings_bookings_org_expected_start_idx" on "bookings_bookings" ("organization_id", "expected_start_on");`);
    this.addSql(`create index "bookings_bookings_open_window_idx" on "bookings_bookings" ("organization_id", "start_at", "end_at") where "deleted_at" is null and "status" in ('planned', 'active');`);
    this.addSql(`create index "bookings_bookings_org_tenant_deleted_idx" on "bookings_bookings" ("organization_id", "tenant_id", "deleted_at");`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_last_warned_chk" check ("last_warned_working_days" is null or "last_warned_working_days" >= 0);`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_duration_chk" check ("duration_value" > 0 and ("duration_unit" <> 'working_days' or ("duration_value" * 2) = floor("duration_value" * 2)));`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_window_order_chk" check ("end_at" is null or "end_at" > "start_at");`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_window_pair_chk" check (("start_at" is null) = ("end_at" is null));`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_status_check" check ("status" in ('planned', 'active', 'completed', 'cancelled', 'no_show'));`);
    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_duration_unit_check" check ("duration_unit" in ('working_days', 'minutes'));`);

    this.addSql(`create table "bookings_participants" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "booking_id" uuid not null, "subject_id" uuid not null, "role" text not null default 'performer', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create unique index "bookings_participants_booking_subject_uq" on "bookings_participants" ("booking_id", "subject_id") where "deleted_at" is null;`);
    this.addSql(`create index "bookings_participants_subject_idx" on "bookings_participants" ("subject_id");`);
    this.addSql(`create index "bookings_participants_org_tenant_deleted_idx" on "bookings_participants" ("organization_id", "tenant_id", "deleted_at");`);
    this.addSql(`alter table "bookings_participants" add constraint "bookings_participants_role_check" check ("role" in ('performer', 'place', 'supporting'));`);

    this.addSql(`alter table "bookings_subjects" add constraint "bookings_subjects_category_id_foreign" foreign key ("category_id") references "bookings_subject_categories" ("id") on delete set null;`);

    this.addSql(`alter table "bookings_conflict_policy_exceptions" add constraint "bookings_conflict_policy_exceptions_category_id_foreign" foreign key ("category_id") references "bookings_subject_categories" ("id");`);

    this.addSql(`alter table "bookings_bookings" add constraint "bookings_bookings_target_id_foreign" foreign key ("target_id") references "bookings_targets" ("id");`);

    this.addSql(`alter table "bookings_participants" add constraint "bookings_participants_booking_id_foreign" foreign key ("booking_id") references "bookings_bookings" ("id");`);
    this.addSql(`alter table "bookings_participants" add constraint "bookings_participants_subject_id_foreign" foreign key ("subject_id") references "bookings_subjects" ("id");`);
  }

}
