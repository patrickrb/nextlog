// Cloudlog compatibility endpoint for the main API info
// Handles the /index.php/api path


// Import the handler from our main Cloudlog API
import { GET as CloudlogGET } from '../../api/cloudlog/route';

export async function GET() {
  return CloudlogGET();
}