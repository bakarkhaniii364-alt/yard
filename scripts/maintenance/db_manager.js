import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utywhgnxqanetqwmhhie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eXdoZ254cWFuZXRxd21oaGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTEzNjgsImV4cCI6MjA5MjM2NzM2OH0.CdTOhJXkR_PKjxoICBeyP8SCtnB2mvCbg3RgIqkh_pk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRooms() {
    const { data, error } = await supabase.from('rooms').select('*');
    if (error) console.error("Error fetching rooms:", error);
    else console.log("Rooms:", data);
}

async function getAppState(roomId) {
    const { data, error } = await supabase.from('app_state').select('*').eq('room_id', roomId);
    if (error) console.error("Error fetching app state:", error);
    else console.log("App State:", data);
}

// Add more functions as needed
const action = process.argv[2];
const arg = process.argv[3];

if (action === 'list-rooms') {
    listRooms();
} else if (action === 'get-state') {
    getAppState(arg);
} else {
    console.log("Usage: node db_manager.js [list-rooms | get-state <room_id>]");
}
