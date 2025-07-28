import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Volume2, 
  Brain, 
  Users, 
  CheckCircle, 
  Star,
  Play,
  MessageSquare,
  Calendar,
  Zap,
  Shield,
  Award,
  Menu,
  X
} from 'lucide-react';

  const Landing = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Volume2,
      title: "음성 인식 회의록",
      description: "실시간 음성을 텍스트로 변환하여 자동으로 회의록을 생성합니다.",
      color: "brand"
    },
    {
      icon: Brain,
      title: "AI 기반 업무 배정",
      description: "회의 내용을 분석하여 적절한 팀원에게 자동으로 업무를 배정합니다.",
      color: "accent-blue"
    },
    {
      icon: Users,
      title: "팀 협업 최적화",
      description: "Slack, Notion, JIRA와 연동하여 원활한 팀 협업을 지원합니다.",
      color: "accent-purple"
    }
  ];

  const testimonials = [
    {
      name: "김대리",
      role: "프로젝트 매니저",
      company: "테크스타트업",
      content: "회의록 작성 시간이 80% 단축되었고, 업무 배정이 훨씬 체계적이 되었습니다.",
      rating: 5
    },
    {
      name: "박팀장",
      role: "개발팀장",
      company: "IT서비스",
      content: "AI가 회의 내용을 정확히 파악해서 각 팀원에게 맞는 업무를 배정해줍니다.",
      rating: 5
    },
    {
      name: "이과장",
      role: "기획팀",
      company: "스타트업",
      content: "모든 팀원이 회의 후 해야 할 일을 명확히 알 수 있어서 업무 효율이 크게 향상되었습니다.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: "스타터",
      price: "무료",
      period: "",
      description: "개인 및 소규모 팀을 위한 기본 플랜",
      features: [
        "월 10회 음성 분석",
        "기본 회의록 생성",
        "최대 5명 팀원",
        "7일 데이터 보관"
      ],
      recommended: false
    },
    {
      name: "프로",
      price: "29,000원",
      period: "/월",
      description: "성장하는 팀을 위한 완전한 솔루션",
      features: [
        "무제한 음성 분석",
        "AI 업무 자동 배정",
        "최대 50명 팀원",
        "30일 데이터 보관",
        "Slack/Notion 연동",
        "우선 고객지원"
      ],
      recommended: true
    },
    {
      name: "엔터프라이즈",
      price: "문의",
      period: "",
      description: "대규모 조직을 위한 맞춤형 솔루션",
      features: [
        "모든 프로 기능",
        "무제한 팀원",
        "무제한 데이터 보관",
        "모든 서비스 연동",
        "전담 고객지원",
        "온프레미스 배포"
      ],
      recommended: false
    }
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* 헤더 */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-neutral-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 로고 */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-neutral-900">TtalKkak</span>
            </div>
            
            {/* 데스크톱 네비게이션 */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-neutral-600 hover:text-neutral-900 transition-colors font-medium">기능</a>
              <a href="#testimonials" className="text-neutral-600 hover:text-neutral-900 transition-colors font-medium">후기</a>
              <a href="#pricing" className="text-neutral-600 hover:text-neutral-900 transition-colors font-medium">요금</a>
            </nav>

            {/* 데스크톱 버튼 */}
            <div className="hidden md:flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="btn-primary"
              >
                시작하기
              </motion.button>
            </div>

            {/* 모바일 메뉴 버튼 */}
            <div className="md:hidden">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </motion.button>
            </div>
          </div>

          {/* 모바일 메뉴 */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden border-t border-neutral-200 bg-white/95 backdrop-blur-md"
              >
                <div className="px-4 py-6 space-y-4">
                  <a 
                    href="#features" 
                    className="block text-neutral-600 hover:text-neutral-900 transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    기능
                  </a>
                  <a 
                    href="#testimonials" 
                    className="block text-neutral-600 hover:text-neutral-900 transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    후기
                  </a>
                  <a 
                    href="#pricing" 
                    className="block text-neutral-600 hover:text-neutral-900 transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    요금
                  </a>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      navigate('/dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full btn-primary mt-4"
                  >
                    시작하기
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* 히어로 섹션 */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-hero">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center px-4 py-2 bg-brand-100 rounded-full text-brand-700 font-medium text-sm mb-6">
                <span className="w-2 h-2 bg-brand-500 rounded-full mr-2 animate-pulse"></span>
                새로운 회의 문화의 시작
              </div>
              <h1 className="heading-xl">
                AI가 만드는
                <span className="text-gradient-brand block">스마트한 회의 문화</span>
              </h1>
              <p className="text-lead mt-6 max-w-3xl mx-auto">
                음성 인식과 AI를 활용해 회의록을 자동 생성하고, 
                팀원별 업무를 지능적으로 배정하는 혁신적인 프로젝트 관리 솔루션
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="px-8 py-4 bg-brand-500 text-white rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-colors flex items-center justify-center"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5 ml-2" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-neutral-100 text-neutral-700 rounded-2xl font-semibold text-lg hover:bg-neutral-200 transition-colors flex items-center justify-center"
              >
                <Play className="w-5 h-5 mr-2" />
                데모 보기
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-16"
            >
              <div className="bg-gradient-to-r from-brand-50 to-brand-100 rounded-3xl p-8 max-w-4xl mx-auto border border-brand-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Volume2 className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-brand-800 mb-2">음성 업로드</h3>
                    <p className="text-brand-600 text-sm">회의 음성을 간단히 업로드</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-brand-800 mb-2">AI 분석</h3>
                    <p className="text-brand-600 text-sm">내용 분석 및 업무 추출</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-brand-800 mb-2">자동 배정</h3>
                    <p className="text-brand-600 text-sm">팀원별 맞춤 업무 배정</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 기능 섹션 */}
      <section id="features" className="py-20 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">
              왜 TtalKkak을 선택해야 할까요?
            </h2>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
              AI 기술로 회의 생산성을 혁신적으로 향상시키는 핵심 기능들
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  onHoverStart={() => setActiveFeature(index)}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                    activeFeature === index 
                      ? 'border-brand-300 bg-brand-50 shadow-medium' 
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl ${
                      feature.color === 'brand' ? 'bg-brand-100' :
                      feature.color === 'accent-blue' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      <feature.icon className={`w-6 h-6 ${
                        feature.color === 'brand' ? 'text-brand-600' :
                        feature.color === 'accent-blue' ? 'text-blue-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900 text-lg mb-2">{feature.title}</h3>
                      <p className="text-neutral-600 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-3xl p-8 text-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                    <Calendar className="w-8 h-8 mb-3" />
                    <div className="text-2xl font-bold">98%</div>
                    <div className="text-sm opacity-90">정확도</div>
                  </div>
                  <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                    <Zap className="w-8 h-8 mb-3" />
                    <div className="text-2xl font-bold">5분</div>
                    <div className="text-sm opacity-90">처리 시간</div>
                  </div>
                  <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                    <Shield className="w-8 h-8 mb-3" />
                    <div className="text-2xl font-bold">100%</div>
                    <div className="text-sm opacity-90">보안</div>
                  </div>
                  <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
                    <Award className="w-8 h-8 mb-3" />
                    <div className="text-2xl font-bold">1000+</div>
                    <div className="text-sm opacity-90">고객사</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 고객 후기 섹션 */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">
              고객들의 생생한 후기
            </h2>
            <p className="text-xl text-neutral-600">
              TtalKkak과 함께 업무 효율성을 경험한 고객들의 이야기
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-neutral-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-neutral-900">{testimonial.name}</div>
                  <div className="text-sm text-neutral-600">{testimonial.role} · {testimonial.company}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 요금 섹션 */}
      <section id="pricing" className="py-20 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">
              합리적인 요금제
            </h2>
            <p className="text-xl text-neutral-600">
              팀 규모와 필요에 맞는 최적의 플랜을 선택하세요
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl p-8 border-2 ${
                  plan.recommended 
                    ? 'border-brand-300 shadow-strong scale-105' 
                    : 'border-neutral-200'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      추천
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-neutral-900">{plan.price}</span>
                    <span className="text-neutral-600">{plan.period}</span>
                  </div>
                  <p className="text-neutral-600 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-brand-500 mr-3 flex-shrink-0" />
                      <span className="text-neutral-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/dashboard')}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    plan.recommended
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {plan.name === '엔터프라이즈' ? '문의하기' : '시작하기'}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ 섹션 */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="heading-lg mb-4">자주 묻는 질문</h2>
            <p className="text-lead">
              TtalKkak에 대해 궁금한 점들을 확인해보세요
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                question: "어떤 파일 형식을 지원하나요?",
                answer: "MP3, WAV, M4A 등 대부분의 음성 파일 형식을 지원합니다. 최대 2시간까지의 회의 음성을 처리할 수 있습니다."
              },
              {
                question: "AI 정확도는 어느 정도인가요?",
                answer: "한국어 음성 인식 정확도는 평균 98% 이상이며, 업무 배정의 정확도는 95% 이상입니다. 지속적인 학습을 통해 정확도가 개선됩니다."
              },
              {
                question: "데이터 보안은 어떻게 관리되나요?",
                answer: "모든 데이터는 AWS의 보안 인프라에서 암호화되어 저장되며, 개인정보보호법과 GDPR을 준수합니다. 회의 내용은 처리 후 자동으로 삭제됩니다."
              },
              {
                question: "기존 도구와 연동이 가능한가요?",
                answer: "Slack, Notion, JIRA, Trello 등 주요 협업 도구와 연동 가능하며, REST API를 통해 커스텀 연동도 지원합니다."
              },
              {
                question: "무료 체험은 어떻게 하나요?",
                answer: "회원가입 없이 바로 무료로 체험할 수 있습니다. 월 10회까지 음성 분석이 가능하며, 모든 기능을 제한 없이 사용할 수 있습니다."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200"
              >
                <h3 className="font-bold text-neutral-900 mb-3 text-lg">{faq.question}</h3>
                <p className="text-neutral-600 leading-relaxed">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 통계 섹션 */}
      <section className="py-20 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              숫자로 보는 TtalKkak의 성과
            </h2>
            <p className="text-xl text-neutral-300">
              전 세계 팀들이 경험한 생산성 향상
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "1,000+", label: "활성 사용자", suffix: "" },
              { number: "50,000+", label: "처리된 회의", suffix: "" },
              { number: "98", label: "음성 인식 정확도", suffix: "%" },
              { number: "75", label: "업무 효율 증가", suffix: "%" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-brand-400 mb-2">
                  {stat.number}{stat.suffix}
                </div>
                <div className="text-neutral-300 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 bg-gradient-brand">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              지금 바로 시작해보세요
            </h2>
            <p className="text-xl text-brand-100 mb-8">
              5분만 투자하면 팀의 회의 문화가 완전히 바뀝니다
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="px-8 py-4 bg-white text-brand-600 rounded-2xl font-semibold text-lg hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5 ml-2" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent text-white border-2 border-white rounded-2xl font-semibold text-lg hover:bg-white hover:text-brand-600 transition-colors inline-flex items-center justify-center"
              >
                <Play className="w-5 h-5 mr-2" />
                데모 보기
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-neutral-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">TtalKkak</span>
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed">
                AI 기반 프로젝트 관리로<br />
                더 스마트한 업무 환경을 만들어갑니다.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">제품</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><a href="#features" className="hover:text-white transition-colors">기능</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">요금제</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">보안</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">지원</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">고객센터</a></li>
                <li><a href="#" className="hover:text-white transition-colors">문서</a></li>
                <li><a href="#" className="hover:text-white transition-colors">커뮤니티</a></li>
                <li><a href="#" className="hover:text-white transition-colors">상태</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">회사</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">회사소개</a></li>
                <li><a href="#" className="hover:text-white transition-colors">채용</a></li>
                <li><a href="#" className="hover:text-white transition-colors">블로그</a></li>
                <li><a href="#" className="hover:text-white transition-colors">연락처</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-neutral-800 mt-8 pt-8 text-center">
            <p className="text-neutral-400 text-sm">
              © 2024 TtalKkak. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;