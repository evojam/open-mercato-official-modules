import { Migration } from '@mikro-orm/migrations';

export class Migration20260926141922_bookings extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "bookings_targets" add "color" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "bookings_targets" drop column "color";`);
  }

}
