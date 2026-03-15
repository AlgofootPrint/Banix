import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Delete storage files
  const { data: images } = await supabase
    .from('saved_images')
    .select('storage_path')
    .eq('user_id', user.id);

  if (images?.length) {
    await supabase.storage.from('saved-images').remove(images.map((i) => i.storage_path));
  }

  // Delete DB records
  await supabase.from('saved_images').delete().eq('user_id', user.id);
  await supabase.from('generation_log').delete().eq('user_id', user.id);
  await supabase.from('user_plans').delete().eq('user_id', user.id);

  // Delete the auth user via admin client
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
