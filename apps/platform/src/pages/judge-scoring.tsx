import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Gavel, 
  Github, 
  Star, 
  Send, 
  GitCommit, 
  Tag, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  status: string;
  description?: string;
}

interface RubricCriterion {
  id: string;
  hackathon_id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface ScoreState {
  score: string;
  comment: string;
}

export function JudgeScoringPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [submissionId, setSubmissionId] = useState('');
  const [scores, setScores] = useState<Record<string, ScoreState>>({});

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      
      try {
        setIsLoading(true);
        
        const [hackathonRes, rubricRes] = await Promise.all([
          apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`),
          apiRequest<{ data: RubricCriterion[] }>(`/api/v1/hackathons/${slug}/rubric`)
        ]);
        
        setHackathon(hackathonRes.data);
        setRubric(rubricRes.data.sort((a, b) => a.sort_order - b.sort_order));
        
        const initialScores: Record<string, ScoreState> = {};
        rubricRes.data.forEach(c => {
          initialScores[c.id] = { score: '', comment: '' };
        });
        setScores(initialScores);
        
      } catch (err) {
        console.error('Failed to load judging data:', err);
        toast.error('Failed to load judging data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [slug]);

  const handleScoreChange = (criteriaId: string, value: string) => {
    if (value !== '' && isNaN(Number(value))) return;
    
    const criterion = rubric.find(c => c.id === criteriaId);
    if (criterion && value !== '') {
      const numVal = Number(value);
      if (numVal < 0 || numVal > criterion.max_score) {
        toast.error(`Score must be between 0 and ${criterion.max_score}`);
        return;
      }
    }

    setScores(prev => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], score: value }
    }));
  };

  const handleCommentChange = (criteriaId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], comment: value }
    }));
  };

  const handleSubmit = async () => {
    if (!submissionId.trim()) {
      toast.error('Please enter a Submission ID');
      return;
    }

    const scoresToSubmit = Object.entries(scores)
      .filter(([_, state]) => state.score !== '')
      .map(([criteriaId, state]) => ({
        criteriaId,
        score: Number(state.score),
        comment: state.comment
      }));

    if (scoresToSubmit.length === 0) {
      toast.error('Please enter at least one score');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const promises = scoresToSubmit.map(item => 
        apiRequest(`/api/v1/hackathons/${slug}/scores`, {
          method: 'POST',
          body: JSON.stringify({
            submissionId: submissionId.trim(),
            criteriaId: item.criteriaId,
            score: item.score,
            comment: item.comment
          })
        })
        .then(() => ({ status: 'fulfilled', id: item.criteriaId }))
        .catch((err) => ({ status: 'rejected', id: item.criteriaId, error: err }))
      );

      const results = await Promise.all(promises);

      results.forEach(res => {
        if (res.status === 'fulfilled') successCount++;
        else failCount++;
      });

      if (failCount === 0) {
        toast.success(`Successfully submitted ${successCount} scores!`);
        setSubmissionId('');
        const resetScores: Record<string, ScoreState> = {};
        rubric.forEach(c => {
          resetScores[c.id] = { score: '', comment: '' };
        });
        setScores(resetScores);
      } else {
        toast.warning(`Submitted ${successCount} scores, but ${failCount} failed.`);
      }

    } catch (err) {
      console.error('Submission error:', err);
      toast.error('An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-white">Hackathon not found</h1>
        <Link to="/dashboard">
          <Button variant="link" className="mt-4">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4">
          <Link to={`/hackathons/${slug}`} className="flex items-center text-sm text-gray-400 hover:text-white transition-colors w-fit">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hackathon
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Gavel className="w-8 h-8 text-[#CCFF00]" />
                Judge Scoring
              </h1>
              <p className="text-gray-400 mt-1">
                {hackathon.title} • <span className="capitalize">{hackathon.status.replace('_', ' ')}</span>
              </p>
            </div>
            <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00]">
              Judge Mode
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-900 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="w-5 h-5 text-[#CCFF00]" />
                  Submission Details
                </CardTitle>
                <CardDescription>
                  Enter the Submission ID you are evaluating.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input 
                    placeholder="Enter Submission UUID..." 
                    value={submissionId}
                    onChange={(e) => setSubmissionId(e.target.value)}
                    className="bg-black border-white/10 text-white font-mono"
                    aria-label="Submission ID"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-[#CCFF00]" />
                Rubric Criteria
              </h2>
              
              {rubric.length === 0 ? (
                <Card className="bg-zinc-900 border-white/10">
                  <CardContent className="p-6 text-center text-gray-400">
                    No rubric criteria defined for this hackathon.
                  </CardContent>
                </Card>
              ) : (
                rubric.map((criterion) => (
                  <Card key={criterion.id} className="bg-zinc-900 border-white/10 overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-medium text-lg text-white">{criterion.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">{criterion.description}</p>
                        </div>
                        <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                          Max: {criterion.max_score}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                        <div className="md:col-span-1">
                          <label className="text-xs font-medium text-gray-500 mb-1.5 block" htmlFor={`score-${criterion.id}`}>
                            Score (0-{criterion.max_score})
                          </label>
                          <Input
                            id={`score-${criterion.id}`}
                            aria-label={`Score for ${criterion.name}`}
                            type="number"
                            min="0"
                            max={criterion.max_score}
                            value={scores[criterion.id]?.score || ''}
                            onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                            className="bg-black border-white/10 text-white text-center font-bold text-lg h-12"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-xs font-medium text-gray-500 mb-1.5 block" htmlFor={`comment-${criterion.id}`}>
                            Comments (Optional)
                          </label>
                          <textarea
                            id={`comment-${criterion.id}`}
                            aria-label={`Comment for ${criterion.name}`}
                            value={scores[criterion.id]?.comment || ''}
                            onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                            className="flex min-h-[48px] w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white resize-none"
                            placeholder="Add feedback..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || rubric.length === 0}
                className="bg-[#CCFF00] text-black hover:bg-[#b3e600] font-bold px-8 py-6 text-lg"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit Scores
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="bg-zinc-900 border-white/10 sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Scoring Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-gray-400">
                <div className="flex gap-3">
                  <div className="bg-white/5 p-2 rounded-lg h-fit">
                    <AlertCircle className="w-4 h-4 text-[#CCFF00]" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Independent Scoring</p>
                    <p>Each criterion is scored independently. You can submit partial scores if needed.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="bg-white/5 p-2 rounded-lg h-fit">
                    <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Final Submission</p>
                    <p>Ensure you have entered the correct Submission ID. Scores are final once submitted.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-white font-medium mb-2">Rubric Summary</h4>
                  <ul className="space-y-2">
                    {rubric.map(c => (
                      <li key={c.id} className="flex justify-between text-xs">
                        <span>{c.name}</span>
                        <span className="text-white">{c.weight}x</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
