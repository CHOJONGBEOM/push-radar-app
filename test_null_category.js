const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mprfnwhfzuyivuxgelol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcmZud2hmenV5aXZ1eGdlbG9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5OTk0MCwiZXhwIjoyMDg1Njc1OTQwfQ.YfQl1ybcF6SDnlFE_yd-3-oq4t4DzshQiWfyLilEe5k';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testNullCategory() {
    console.log('=== TESTING NULL CATEGORY INSERT ===\n');

    const testMessage = {
        package_name: 'com.test.openai',
        app_name: 'OpenAI Test',
        title: '50% 할인 이벤트',
        body: '오늘만 특가! 모든 상품 반값 세일',
        posted_at: new Date().toISOString(),
        is_ad: false,
        category: null,  // NULL로 보내서 OpenAI trigger 실행
        has_emoji: false,
        message_length: 20
    };

    console.log('Sending message with category: null');
    console.log('Expected: OpenAI trigger should analyze and set category\n');

    try {
        const { data, error } = await supabase
            .from('push_messages')
            .insert([testMessage])
            .select();

        if (error) {
            console.error('❌ INSERT FAILED:');
            console.error('Message:', error.message);
            console.error('Code:', error.code);
            console.error('\nFull Error:');
            console.error(JSON.stringify(error, null, 2));
        } else {
            console.log('✅ INSERT SUCCEEDED!');
            console.log('Inserted data:', data);

            if (data && data[0]) {
                console.log('\n🎯 Category assigned by OpenAI:', data[0].category);

                // Cleanup
                await supabase.from('push_messages').delete().eq('id', data[0].id);
                console.log('Test record cleaned up.');
            }
        }
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

testNullCategory();
